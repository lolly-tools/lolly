// SPDX-License-Identifier: MPL-2.0
/**
 * The handles on 3D Studio's selected object, without a browser (handle-geometry.ts): the
 * turn snap, the lift snap, the scale range, the footprint a ring is drawn round, and where
 * the ring falls on the screen through a real three.js camera.
 *
 * Run directly:  node --test shells/web/src/lib/studio3d/handle-geometry.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import {
  STUDIO_SCALE_MAX,
  STUDIO_SCALE_MIN,
  studioClampScale,
  studioFloorAngle,
  studioFootprint,
  studioProject,
  studioRingFront,
  studioRingPoint,
  studioRingRuns,
  studioSnapLift,
  studioSnapTurn,
  studioWrapDegrees,
} from './handle-geometry.ts';

test('a turn snaps to 15 degrees, wraps to -180 to 180, and Alt keeps whole degrees', () => {
  assert.equal(studioSnapTurn(44), 45);
  assert.equal(studioSnapTurn(52), 45);
  assert.equal(studioSnapTurn(53), 60);
  assert.equal(studioSnapTurn(-7), 0);
  assert.equal(Object.is(studioSnapTurn(-7), -0), false, 'no negative zero reaches a saved value');
  assert.equal(studioSnapTurn(200), -165);
  assert.equal(studioSnapTurn(-185), 180);
  assert.equal(studioSnapTurn(178), 180);
  assert.equal(studioSnapTurn(44.4, true), 44);
  assert.equal(studioSnapTurn(370.2, true), 10);
  assert.equal(studioWrapDegrees(180), 180);
  assert.equal(studioWrapDegrees(-180), -180);
  assert.equal(studioWrapDegrees(540), 180);
});

test('a lift lands on the stage when it comes close, and Alt lets it hover', () => {
  assert.equal(studioSnapLift(0.04), 0);
  assert.equal(studioSnapLift(-0.03), 0);
  assert.equal(studioSnapLift(0.05), 0.05);
  assert.equal(studioSnapLift(0.30049), 0.3);
  assert.equal(studioSnapLift(0.04, true), 0.04);
  assert.equal(studioSnapLift(Number.NaN), 0);
});

test('a scale stays in 0.1 to 5, to two places', () => {
  assert.equal(studioClampScale(0.01), STUDIO_SCALE_MIN);
  assert.equal(studioClampScale(9), STUDIO_SCALE_MAX);
  assert.equal(studioClampScale(1.234), 1.23);
  assert.equal(studioClampScale(Number.POSITIVE_INFINITY), 1);
});

function camera(azimuth: number, elevation: number, distance = 8): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const a = THREE.MathUtils.degToRad(azimuth),
    e = THREE.MathUtils.degToRad(elevation);
  view.position.set(distance * Math.cos(e) * Math.sin(a), distance * Math.sin(e), distance * Math.cos(e) * Math.cos(a));
  view.lookAt(0, 0, 0);
  view.updateMatrixWorld(true);
  return view;
}

function mesh(geometry: THREE.BufferGeometry, x = 0, z = 0): THREE.Mesh {
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  object.position.set(x, 0, z);
  object.updateMatrixWorld(true);
  return object;
}

test('the footprint of a ball is the ball, and of a box is its half diagonal', () => {
  const ball = studioFootprint(mesh(new THREE.SphereGeometry(0.5, 32, 16), 1, -1), 0)!;
  assert.ok(Math.abs(ball.radius - 0.5 * 1.08) < 0.01, `ball ring ${ball.radius}`);
  assert.deepEqual([ball.center.x, ball.center.y, ball.center.z].map((n) => Math.round(n * 1000) / 1000), [1, 0, -1]);
  const cube = studioFootprint(mesh(new THREE.BoxGeometry(1, 1, 1)), 0)!;
  assert.ok(Math.abs(cube.radius - Math.SQRT1_2 * 1.08) < 0.01, `cube ring ${cube.radius}`);
  // A ring holds the footprint: every corner of the cube's base is inside the ring.
  for (const [x, z] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) assert.ok(Math.hypot(x!, z!) < cube.radius);
  assert.equal(studioFootprint(new THREE.Group(), 0), null, 'nothing placed, no ring');
});

test('ring points and floor angles share one convention: 0 faces +z, 90 faces +x', () => {
  const footprint = studioFootprint(mesh(new THREE.SphereGeometry(1, 16, 8)), 0)!;
  const east = studioRingPoint(footprint, 90);
  assert.ok(Math.abs(east.x - footprint.radius) < 1e-9 && Math.abs(east.z) < 1e-9);
  assert.ok(Math.abs(studioFloorAngle(footprint, east) - 90) < 1e-9);
  assert.ok(Math.abs(studioFloorAngle(footprint, studioRingPoint(footprint, -135)) + 135) < 1e-9);
  // The knob rests on the side of the ring that faces the eye.
  assert.ok(Math.abs(studioRingFront(camera(25, 14), footprint) - 25) < 1e-6);
  assert.ok(Math.abs(studioRingFront(camera(-90, 30), footprint) + 90) < 1e-6);
});

test('the ring projects round the subject and breaks where the subject hides it', () => {
  // From straight above, the whole ring round a low tile is seen, centred, as one closed run.
  const tile = studioFootprint(mesh(new THREE.BoxGeometry(1, 0.1, 1).translate(0, 0.05, 0)), 0)!;
  const whole = studioRingRuns(camera(0, 89.9), tile);
  assert.equal(whole.length, 1);
  assert.deepEqual(whole[0]![0], whole[0]!.at(-1), 'a whole ring closes on its first point');
  const xs = whole[0]!.map((p) => p[0]),
    ys = whole[0]!.map((p) => p[1]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 0.5) < 0.01);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 0.5) < 0.01);
  // From the side and a little above, the back of the ring is behind a tall box: one run, open.
  const footprint = studioFootprint(mesh(new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0)), 0)!;
  const side = camera(0, 14);
  const runs = studioRingRuns(side, footprint);
  assert.equal(runs.length, 1, 'the front arc is one run');
  const front = studioProject(side, studioRingPoint(footprint, 0))!;
  const back = studioProject(side, studioRingPoint(footprint, 180))!;
  assert.ok(front[1] > back[1], 'the front of the ring is lower on the screen');
  const near = (p: [number, number]) => runs[0]!.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9);
  assert.ok(near(front), 'the front of the ring is drawn');
  assert.ok(!near(back), 'the back of the ring, behind the box, is not');
  // A ring that hugs a ball passes inside the corners of the ball's box. From a view at an
  // angle to the box's sides, the front of that ring is still drawn and its back is not.
  const ball = studioFootprint(mesh(new THREE.SphereGeometry(0.5, 32, 16).translate(0, 0.5, 0)), 0)!;
  const angled = camera(25, 14);
  const ballRuns = studioRingRuns(angled, ball);
  const onRun = (p: [number, number]) => ballRuns.some((run) => run.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9));
  assert.ok(onRun(studioProject(angled, studioRingPoint(ball, 25))!), 'the front of the ring round a ball is drawn');
  assert.ok(!onRun(studioProject(angled, studioRingPoint(ball, 205))!), 'its back, behind the ball, is not');
  // A point behind the camera does not project.
  assert.equal(studioProject(side, new THREE.Vector3(0, 0, 20)), null);
});
