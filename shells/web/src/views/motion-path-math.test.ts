// SPDX-License-Identifier: MPL-2.0
/**
 * motion-path-math - the arithmetic behind editing a motion path (plans/330), and the
 * promise every other track edit now keeps: a keyframe's path handles are still there afterwards.
 *
 *   - the projector maps a keyframe's surface offset to where the camera shows it and
 *     back, exactly, flat or tilted;
 *   - position and handle edits change only what they name;
 *   - Curve the path gives smooth handles between neighbours, a gentle S through three
 *     points in a line, and a bow at the ends;
 *   - split, trim, join, a new keyframe inside a curve, retime, duplicate, a new ease,
 *     a rescale and the property-filter moves all keep (or exactly split) the handles.
 *
 * Run directly:  node --test shells/web/src/views/motion-path-math.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateKf, parseKf, serialiseKf, type KfKey, type KfTrack } from '../../../../engine/src/keyframes.ts';
import {
  autoHandles, handlesInLine, kfTrackCurve, kfTrackSetHandles, kfTrackSetPosition, kfTrackStraighten,
  mirrorHandle, pathKeyPoints, pathProjector,
} from './motion-path-math.ts';
import {
  kfCameraClips, kfTrackAfter, kfTrackBefore, kfTrackDuplicate, kfTrackJoin, kfTrackRetime, kfTrackSetEase,
  rescaleKfTrack, writeKfPose, type Box, type TimeCfg,
} from './timeline-math.ts';
import { kfTrackDropChannels, kfTrackMoveChannels, kfTrackPutChannels } from './kf-props.ts';

const cfg: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane', kfField: 'kf', zField: 'z',
};

const CURVED = 't0_el_x0_y0_ho(100)(0)*t1000_x200_y0_hi(0)(-100)*t2000_x300_y100';
const wire = (keys: readonly KfKey[]): string => serialiseKf(keys);
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

// ── the projector ─────────────────────────────────────────────────────────────

test('pathProjector: surface offset to native and back, under a moving and a tilted camera', () => {
  for (const camKf of ['t0_x0_z0*t2000_x120_z-300', 't0_rx-25_ry10*t2000_rx-5_x40']) {
    const box: Box = { id: 'a', start: 0.5, dur: 3, kf: 't0_x0_y0_z80*t1000_x100_y40_z140' };
    const camera: Box = { id: 'cam', kind: 'camera', start: 0, dur: 6, kf: camKf };
    const env = { stageW: 1200, stageH: 800, cameras: kfCameraClips([box, camera], cfg), totalMs: 6000 };
    const proj = pathProjector(box, cfg, { x: 300, y: 200 }, env);
    for (const ms of [0, 400, 1000]) {
      const p = proj.project(ms, 37, -12);
      const back = proj.unproject(ms, p.x, p.y)!;
      assert.ok(near(back.x, 37) && near(back.y, -12), `${camKf} at ${ms}: ${JSON.stringify(back)}`);
    }
  }
});

test('pathKeyPoints: every keyframe in the window, which can move and which can curve', () => {
  const box: Box = { id: 'a', start: 0, dur: 2, kf: `${CURVED}*t1500_o0.5*t9000_x1_y1` };
  const pts = pathKeyPoints(box, cfg, { x: 50, y: 50 }, { stageW: 400, stageH: 400 });
  assert.deepEqual(pts.map((p) => p.t), [0, 1000, 1500, 2000], 'the 9 s keyframe is past the out-point');
  assert.deepEqual(pts.map((p) => [p.pos, p.curve]), [[true, true], [true, true], [false, false], [true, true]]);
  assert.deepEqual([pts[0]!.x, pts[0]!.y], [50, 50]);
  assert.deepEqual(pts[0]!.ho, { x: 150, y: 50 }, 'a handle tip is the point plus the handle, projected');
  assert.equal(pts[0]!.hi, undefined);
  assert.deepEqual(pts[1]!.hi, { x: 250, y: -50 });
});

// ── edits that name what they change ──────────────────────────────────────────

test('kfTrackSetPosition moves one keyframe, carrying its handles, its ease and its other channels', () => {
  const tr = parseKf('t0_eo_x0_y0_s1.2_ho(10)(0)*t1000_x100_y0');
  assert.equal(wire(kfTrackSetPosition(tr, 0, 30, -20)), 't0_eo_x30_y-20_s1.2_ho(10)(0)*t1000_x100_y0');
  assert.equal(wire(kfTrackSetPosition(tr, 500, 1, 1)), wire(tr), 'no keyframe there, no change');
});

test('kfTrackSetHandles sets, keeps and retracts each side on its own', () => {
  const tr = parseKf('t0_x0_y0_hi(5)(5)_ho(10)(0)*t1000_x100_y0');
  assert.equal(wire(kfTrackSetHandles(tr, 0, undefined, [20, 20])), 't0_x0_y0_hi(5)(5)_ho(20)(20)*t1000_x100_y0');
  assert.equal(wire(kfTrackSetHandles(tr, 0, null, undefined)), 't0_x0_y0_ho(10)(0)*t1000_x100_y0');
  assert.equal(wire(kfTrackStraighten(tr, 0)), 't0_x0_y0*t1000_x100_y0');
  const noPos = parseKf('t0_x0_y0*t500_o0.5*t1000_x1_y1');
  assert.equal(wire(kfTrackSetHandles(noPos, 500, [1, 1], [2, 2])), wire(noPos), 'no position, no handle');
});

test('Curve the path: smooth between neighbours, an S through a straight line, a bow at the ends', () => {
  const corner = parseKf('t0_x0_y0*t1000_x100_y0*t2000_x100_y100');
  const mid = autoHandles(corner, 1000)!;
  // Parallel to next minus previous, (100, 100), each a third of its own segment.
  assert.ok(near(mid.ho![0], mid.ho![1]) && mid.ho![0] > 0, `ho along (1, 1): ${mid.ho}`);
  assert.ok(near(mid.hi![0], mid.hi![1]) && mid.hi![0] < 0, `hi the other way: ${mid.hi}`);
  assert.ok(near(Math.hypot(...mid.ho!), 100 / 3, 1e-9));
  assert.ok(handlesInLine(mid.hi, mid.ho), 'a smooth point: the two handles in one line');

  const line = parseKf('t0_x0_y0*t1000_x100_y0*t2000_x200_y0');
  const s = autoHandles(line, 1000)!;
  assert.ok(Math.abs(s.ho![1]) > 1, 'three points in a line still get a visible curve');
  assert.ok(handlesInLine(s.hi, s.ho));

  const two = parseKf('t0_x0_y0*t1000_x300_y0');
  const first = autoHandles(two, 0)!, last = autoHandles(two, 1000)!;
  assert.equal(first.hi, null);
  assert.equal(last.ho, null);
  assert.ok(Math.sign(first.ho![1]) === Math.sign(last.hi![1]) && first.ho![1] !== 0, 'both ends bow to the same side');
  const curved = kfTrackCurve(kfTrackCurve(two, 0), 1000);
  assert.ok(Math.abs(evaluateKf(curved, 500).y!) > 10, 'and the travel between them now bends');

  assert.equal(autoHandles(parseKf('t0_x0_y0*t1000_o0'), 0), null, 'a lone position has nothing to curve toward');
});

test('handlesInLine and mirrorHandle: the pen tool\'s smooth node', () => {
  assert.equal(handlesInLine([-10, 0], [20, 0]), true);
  assert.equal(handlesInLine([-10, 0], [20, 5]), false);
  assert.equal(handlesInLine(undefined, [20, 0]), false);
  const m = mirrorHandle([0, 30], [-10, 0])!;
  assert.ok(near(m[0], 0) && near(m[1], -10), `opposite the dragged one, its own length: ${m}`);
});

// ── every other track edit keeps the handles ──────────────────────────────────

const curvedTrack = (): KfTrack => parseKf(CURVED);
const travel = (tr: readonly KfKey[], from: number, to: number, shift = 0): [number, number][] => {
  const out: [number, number][] = [];
  for (let t = from; t <= to; t += 50) {
    const p = evaluateKf(tr as KfTrack, t - shift);
    out.push([p.x!, p.y!]);
  }
  return out;
};
const sameTravel = (a: [number, number][], b: [number, number][], tol: number, what: string): void => {
  assert.equal(a.length, b.length);
  a.forEach((p, i) => {
    assert.ok(Math.hypot(p[0] - b[i]![0], p[1] - b[i]![1]) < tol, `${what} sample ${i}: ${p} vs ${b[i]}`);
  });
};

test('a split inside a curve keeps both halves on it, and joining them back is the original', () => {
  const tr = curvedTrack();
  const before = parseKf(serialiseKf(kfTrackBefore(tr, 400)));
  const after = parseKf(serialiseKf(kfTrackAfter(tr, 400)));
  sameTravel(travel(before, 0, 400), travel(tr, 0, 400), 0.5, 'first half');
  sameTravel(travel(after, 400, 1000, 400), travel(tr, 400, 1000), 0.5, 'second half');
  const joined = parseKf(serialiseKf(kfTrackJoin(before, after, 400)));
  sameTravel(travel(joined, 0, 2000), travel(tr, 0, 2000), 0.5, 'joined');
  // A trim that reveals head only shifts, handles and all.
  assert.equal(wire(kfTrackAfter(tr, -200)), 't200_el_x0_y0_ho(100)(0)*t1200_x200_y0_hi(0)(-100)*t2200_x300_y100');
});

test('writeKfPose keeps a keyframe\'s handles, and a new position inside a curve splits it', () => {
  const box: Box = { id: 'a', start: 0, dur: 3, kf: CURVED };
  // Parked on a diamond: a canvas drag adds to x/y and leaves the handles alone.
  const moved = writeKfPose([box], cfg, 'a', 1, { x: 5, y: 5 }, 'add');
  assert.equal(String(moved[0]!.kf), 't0_el_x0_y0_ho(100)(0)*t1000_x205_y5_hi(0)(-100)*t2000_x300_y100');
  // +Keyframe mid-curve writes the pose there and the handles that keep the path's shape.
  const keyed = writeKfPose([box], cfg, 'a', 0.5, {}, 'add');
  const tr = parseKf(String(keyed[0]!.kf));
  assert.equal(tr.length, 4);
  const midKey = tr.find((k) => k.t === 500)!;
  assert.ok(midKey.hi && midKey.ho, 'the new keyframe carries the split handles');
  // The shape: every point of the new path lies on the old one (the timing re-eases).
  const old = travel(curvedTrack(), 0, 1000).concat(Array.from({ length: 200 }, (_, i) => {
    const p = evaluateKf(curvedTrack(), i * 5);
    return [p.x!, p.y!] as [number, number];
  }));
  for (const [x, y] of travel(tr, 0, 1000)) {
    const d = Math.min(...old.map(([ox, oy]) => Math.hypot(ox - x, oy - y)));
    assert.ok(d < 1.5, `(${x}, ${y}) is on the original curve (${d.toFixed(2)} px away)`);
  }
});

test('retime, duplicate, a new ease and a rescale keep the handles', () => {
  const tr = curvedTrack();
  assert.match(wire(kfTrackRetime(tr, 1000, 1200)), /t1200_x200_y0_hi\(0\)\(-100\)/);
  assert.match(wire(kfTrackDuplicate(tr, 0, 1500)), /t1500_el_x0_y0_ho\(100\)\(0\)/);
  assert.match(wire(kfTrackSetEase(tr, 0, 'ease-out')), /^t0_eo_x0_y0_ho\(100\)\(0\)/);
  assert.match(wire(rescaleKfTrack(tr, 4000)), /t2000_x200_y0_hi\(0\)\(-100\)/);
});

test('the property filter: a position carries its handles, another property leaves them be', () => {
  const tr = parseKf('t0_x0_y0_o1_ho(50)(0)*t1000_x100_y0_o0');
  assert.equal(wire(kfTrackPutChannels(tr, 0, { o: 0.5 })), 't0_x0_y0_o0.5_ho(50)(0)*t1000_x100_y0_o0');
  assert.equal(wire(kfTrackDropChannels(tr, 0, ['o'])), 't0_x0_y0_ho(50)(0)*t1000_x100_y0_o0');
  assert.equal(wire(kfTrackDropChannels(tr, 0, ['x', 'y'])), 't0_o1*t1000_x100_y0_o0', 'no position, no handle');
  const movedPos = wire(kfTrackMoveChannels(tr, 0, 300, ['x', 'y']));
  assert.equal(movedPos, 't0_o1*t300_x0_y0_ho(50)(0)*t1000_x100_y0_o0');
  const movedFade = wire(kfTrackMoveChannels(tr, 0, 300, ['o']));
  assert.equal(movedFade, 't0_x0_y0_ho(50)(0)*t300_o1*t1000_x100_y0_o0');
});
