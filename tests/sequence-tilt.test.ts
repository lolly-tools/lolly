// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P2 — the tilt tier where it meets the two EVALUATORS and the compositor gate.
 *
 * `tests/keyframes-tilt.test.ts` pins the engine's maths; this file pins what the shell
 * does with it, and every case here is one of the three seams P2 actually cuts:
 *
 *  • **`composeTransform`** — the DOM writes the engine's homography as a per-element
 *    `matrix3d`, in the leading translate's place and nowhere else. With no matrix the
 *    string it produces must be the one it has always produced, character for character.
 *  • **The fold and the plan** — `m3` reaches `PlanItem` only under a tilted camera, and
 *    `viewMoves`/`camerasMove` both learn to count a tilt (a flat box under a tilted
 *    camera has to be projected, and a plate cannot bake a filter for a camera that is
 *    turning).
 *  • **`camerasTilt`** — the gate `renderSequence` branches on, including the TRIGGER it
 *    reports, because §6.4 asks for the branch to be "logged with the trigger".
 *
 * jsdom-free: everything here is a pure function over plain objects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeTransform } from '../shells/web/src/bridge/sequence-dom.ts';
import {
  camerasMove, camerasTilt, foldKfPose, planCameraView, REST_TRANSITION, viewMoves,
  type SeqPlanEnv,
} from '../shells/web/src/bridge/sequence-plan.ts';
import { parseKf, projectSurfacePoint, DEFAULT_PERSPECTIVE, type KfCameraClip } from '../engine/src/keyframes.ts';

const W = 1920;
const H = 1080;

const env = (cameras: KfCameraClip[]): SeqPlanEnv => ({ stageW: W, stageH: H, cameras });
const camClip = (kf: string): KfCameraClip => ({ start: 0, end: null, base: null, track: parseKf(kf) });

// ── composeTransform ─────────────────────────────────────────────────────────

test('composeTransform with NO matrix is byte-identical to what it always wrote', () => {
  // The parameter is optional and defaulted for exactly this reason: every call site
  // that predates P2 keeps its output, and the ones that do not pass it cannot change.
  const tr = { dx: 12.3456, dy: -7, sc: 1.25, rot: 15 };
  const want = 'translate(12.346px, -7px) rotate(4deg) rotate(15deg) scale(1.25)';
  assert.equal(composeTransform('rotate(4deg)', tr), want);
  assert.equal(composeTransform('rotate(4deg)', tr, null), want);
  // …including the shapes that emit nothing at all.
  assert.equal(composeTransform('', { dx: 0, dy: 0, sc: 1, rot: 0 }), '');
  assert.equal(composeTransform('none', { dx: 0, dy: 0, sc: 1, rot: 0 }, null), '');
});

test('a matrix REPLACES the leading translate and nothing else in the list', () => {
  const tr = { dx: 40, dy: -20, sc: 1.5, rot: 12 };
  const m = [1, 0, 30, 0, 0.766, -12, 0, -0.000536, 1] as const;
  const out = composeTransform('rotate(4deg)', tr, m);
  assert.match(out, /^matrix3d\(/, 'the homography leads, where the translate used to');
  assert.ok(!out.includes('translate('), 'and the translate is gone, not doubled');
  // The tail is untouched: authored transform, then the animation rotate, then the
  // scale — which still carries eff, because the engine divides it back out of the
  // matrix. Order is what makes a hand-rotated box keep spinning about its own centre.
  assert.ok(out.endsWith('rotate(4deg) rotate(12deg) scale(1.5)'), out);
  // A zero-length translate still yields a matrix: `m3` is not an optimisation, it is
  // the projection, so it is emitted whenever the camera is tilted.
  const still = composeTransform('', { dx: 0, dy: 0, sc: 1, rot: 0 }, m);
  assert.match(still, /^matrix3d\(/);
});

// ── the fold + the plan ──────────────────────────────────────────────────────

const foldAt = (cameras: KfCameraClip[], t: number, over: Record<string, unknown> = {}): ReturnType<typeof foldKfPose> =>
  foldKfPose({
    view: planCameraView(env(cameras), t),
    cx: 640, cy: 400, tr: REST_TRANSITION, pose: {},
    zField: 0, authoredBlur: 0, boxW: 320, boxH: 200,
    ...over,
  } as Parameters<typeof foldKfPose>[0]);

test('the fold carries m3 only under a tilted camera', () => {
  assert.equal(foldAt([], 0).m3, null, 'no camera at all');
  assert.equal(foldAt([camClip('t0_z-220*t4000_z0')], 0).m3, null, 'a dolly is affine');
  assert.equal(foldAt([camClip('t0_x-140*t4000_x140')], 2000).m3, null, 'so is a pan');
  const tilted = foldAt([camClip('t0_rx-40*t4000_rx0')], 0);
  assert.ok(tilted.m3, 'a tilt is not');
  assert.equal(tilted.m3?.length, 9, 'a 3x3, row-major');
  // …and the SAME track at the instant its angle passes through zero is affine again.
  // The two tiers meet continuously, which is what makes the exact-zero gate safe.
  assert.equal(foldAt([camClip('t0_rx-40*t4000_rx0')], 4000).m3, null);
});

test('the byte-identity short-circuit never fires under tilt, even at eff exactly 1', () => {
  // ⚑ `foldKfPose`'s `flat` fast path exists to keep an untilted document byte-identical:
  // `W/2 + (cx + dx − W/2)` is identity in ℝ and NOT in IEEE-754, so with eff 1 and a
  // parked camera the transition offset is taken straight through. That reasoning is the
  // AFFINE tier's, and under tilt its premise is false — `proj.scale` is `P/D` at the
  // layer's posed CENTRE and can be exactly 1 while the homography has still moved that
  // centre. `ry = 45` puts sin = cos in IEEE, so a layer 100 px off the stage centre at
  // z = −100 lands `dC === P` exactly: eff 1, camera parked, and 41.42 px of real
  // displacement that the short-circuit used to throw away. `PlanItem.dx` is documented
  // as the projected centre and is what the chrome (handles, motion path) reads.
  const view = planCameraView(env([{ start: 0, end: null, base: { ry: 45 }, track: null }]), 0);
  const bx = W / 2 + 100;
  const fold = foldKfPose({
    view, cx: bx, cy: H / 2, tr: REST_TRANSITION, pose: {},
    zField: -100, authoredBlur: 0, boxW: 200, boxH: 120,
  } as Parameters<typeof foldKfPose>[0]);
  assert.equal(fold.scale, 1, 'precondition: this is the eff-exactly-1 case, or the test is vacuous');
  assert.equal(view.x, 0, 'precondition: the camera is parked, so `flat` would otherwise be true');
  const truth = projectSurfacePoint({ ...view, w: W, h: H }, bx, H / 2, -100)!;
  assert.ok(Math.abs(truth.x - bx) > 40, `precondition: the homography really moves the centre (${truth.x - bx})`);
  assert.ok(Math.abs(fold.dx - (truth.x - bx)) < 1e-9,
    `the fold must report the PROJECTED centre, got ${fold.dx} want ${truth.x - bx}`);
  assert.ok(fold.m3, 'and it still hands out the matrix');
});

test('…and the untilted floor is untouched by that clause', () => {
  // The other half: with no angle authored, `flat` is still true and the offsets are
  // still the transition's own bits. `Object.is`, because the whole point is IEEE
  // identity rather than numeric equality.
  const view = planCameraView(env([]), 0);
  const tr = { dx: 0.1, dy: -0.3, sc: 1, rot: 0, alpha: 1 };
  const fold = foldKfPose({
    view, cx: 10, cy: 20, tr, pose: {},
    zField: 0, authoredBlur: 0, boxW: 200, boxH: 120,
  } as Parameters<typeof foldKfPose>[0]);
  assert.ok(Object.is(fold.dx, tr.dx), `dx must be the transition's own bits, got ${fold.dx}`);
  assert.ok(Object.is(fold.dy, tr.dy), `dy must be the transition's own bits, got ${fold.dy}`);
  assert.equal(fold.m3, null);
});

test('a flat box under a tilted camera is still projected (viewMoves counts the tilt)', () => {
  // The bug this exists to prevent: `viewMoves` decides whether a z = 0 box is folded at
  // all. Leaving the tilt out of it would have pitched every LIFTED layer while every
  // flat one stayed square — an artwork that comes apart at the first degree.
  const flat = planCameraView(env([camClip('t0_rx-40')]), 0);
  assert.equal(viewMoves(flat), true);
  assert.equal(viewMoves(planCameraView(env([]), 0)), false, 'and the default camera still moves nothing');
  assert.equal(
    viewMoves(planCameraView(env([{ start: 0, end: null, base: { p: 600 }, track: null }]), 0)),
    false,
    'perspective strength alone is a no-op on a flat scene (§4.3) — unchanged by P2',
  );
  // The fold on a z = 0, kf-less box: it must actually move.
  const posed = foldAt([camClip('t0_rx-40')], 0, { cy: 900 });
  assert.ok(posed.m3, 'a flat box gets the matrix too');
  assert.ok(Math.abs(posed.dy) > 1, `a flat box below the aim point must move, got dy=${posed.dy}`);
});

test('paint order stays the z order under tilt — parallel planes cannot cross', () => {
  // The claim the plan path's sort rests on (§4.2 under P2): the order that reproduces
  // a perspective render is the VIEW-AXIS one, and a pitched camera's view axis is not
  // the z axis — but the layers are parallel planes, so a higher `z` is nearer
  // everywhere the two overlap as long as `κ = cos(rx)·cos(ry) > 0`. Checked by
  // projecting the same point on two planes and comparing depths, across the whole
  // usable range and at several screen positions.
  for (const [rx, ry] of [[-75, 0], [-40, 0], [0, 60], [-38, 22], [80, -80]] as const) {
    const cam = { ...planCameraView(env([{ start: 0, end: null, base: { rx, ry }, track: null }]), 0) };
    for (const [x, y] of [[W / 2, H / 2], [0, 0], [W, H], [W, 0]] as const) {
      const lo = projectSurfacePoint(cam, x, y, 0);
      const hi = projectSurfacePoint(cam, x, y, 240);
      if (!lo || !hi) continue;
      assert.ok(hi.d < lo.d,
        `rx=${rx} ry=${ry} at (${x},${y}): z 240 must be NEARER than z 0 (${hi.d} vs ${lo.d})`);
    }
  }
});

test('camerasMove counts a tilt, so a moving camera owns every layer’s filter', () => {
  // §5.5's ownership predicate is asked ONCE for a whole render, and a tilt changes both
  // eff and the depth-of-field radius per frame — a plate cannot bake either.
  assert.equal(camerasMove([{ start: 0, end: null, base: { rx: -40 }, track: null }]), true);
  assert.equal(camerasMove([{ start: 0, end: null, base: { ry: 12 }, track: null }]), true);
  assert.equal(camerasMove([{ start: 0, end: null, base: null, track: null }]), false);
  assert.equal(
    camerasMove([{ start: 0, end: null, base: { p: DEFAULT_PERSPECTIVE }, track: null }]),
    false,
    'the documented default pose is not a move',
  );
});

// ── the gate ─────────────────────────────────────────────────────────────────

test('camerasTilt finds the trigger, and names it', () => {
  assert.equal(camerasTilt(null), null);
  assert.equal(camerasTilt([]), null);
  assert.equal(camerasTilt([camClip('t0_z-220*t4000_z0')]), null, 'a dolly is not a tilt');

  // From a base pose: no time to report, because it is the scene pose.
  assert.deepEqual(
    camerasTilt([{ start: 0, end: null, base: { rx: -40 }, track: null }]),
    { ch: 'rx', deg: -40, atMs: null },
  );
  // From a track: the SEQUENCE time, so the log can point at a frame.
  assert.deepEqual(
    camerasTilt([{ start: 1500, end: null, base: null, track: parseKf('t0_x0*t2000_ry22') }]),
    { ch: 'ry', deg: 22, atMs: 3500 },
  );
  // COARSE by design, exactly like `camerasMove`: an angle anywhere in the set makes the
  // whole render a tilted one, even a track that is level for most of its length. The
  // answer decides which compositor runs, and that cannot change mid-film.
  assert.ok(camerasTilt([camClip('t0_rx0*t100_rx-1*t4000_rx0')]));
  // A track that only ever says zero is not a tilt — the wire may carry the channel.
  assert.equal(camerasTilt([camClip('t0_rx0*t4000_rx0')]), null);
  // Junk in the clip list is skipped rather than thrown on (untrusted-input posture).
  assert.equal(camerasTilt([null as never, undefined as never, camClip('t0_x10')]), null);
});
