// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { studioHoldInRect, studioLightPoint } from './handle-geometry.ts';

const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  c.position.set(0, 1.5, 8);
  c.lookAt(0, 1.5, 0);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};

test('a light in front of the camera stands where the light is seen, inside the frame or beyond the edge', () => {
  const centre = studioLightPoint(camera(), new THREE.Vector3(0, 1.5, 0));
  assert.equal(centre.behind, false);
  assert.ok(Math.abs(centre.point[0] - 0.5) < 1e-6 && Math.abs(centre.point[1] - 0.5) < 1e-6);
  // A side light far to the right is out of the frame, and still has a place.
  const side = studioLightPoint(camera(), new THREE.Vector3(9, 1.5, 0));
  assert.equal(side.behind, false);
  assert.ok(side.point[0] > 1, 'beyond the right edge of the frame');
  // A light above and behind the subject is out of the top.
  const rim = studioLightPoint(camera(), new THREE.Vector3(0, 9, -3));
  assert.ok(rim.point[1] < 0, 'beyond the top edge of the frame');
});

test('a light behind the camera gives the side the light is on, never a missing handle', () => {
  const left = studioLightPoint(camera(), new THREE.Vector3(-4, 1.5, 12));
  assert.equal(left.behind, true);
  assert.ok(left.point[0] < -0.9 && Math.abs(left.point[1]) < 0.1, 'to the left');
  const above = studioLightPoint(camera(), new THREE.Vector3(0, 6, 12));
  assert.equal(above.behind, true);
  assert.ok(above.point[1] < -0.9, 'up, which is less on the screen');
  // Straight behind the eye there is no side, so the handle stands above the frame.
  assert.deepEqual(studioLightPoint(camera(), new THREE.Vector3(0, 1.5, 20)), { point: [0, -1], behind: true });
});

test('a handle is held within reach on the side its light is on', () => {
  const rect = { left: 100, top: 100, right: 500, bottom: 400 };
  assert.deepEqual(studioHoldInRect([300, 250], [320, 260], rect), { point: [320, 260], held: false });
  // Far to the right: held at the right edge, on the line from the aim point.
  assert.deepEqual(studioHoldInRect([300, 250], [2300, 250], rect), { point: [500, 250], held: true });
  // Far up and to the left: the top edge is met first.
  const corner = studioHoldInRect([300, 250], [-700, -1250], rect);
  assert.equal(corner.held, true);
  assert.equal(corner.point[1], 100);
  assert.ok(corner.point[0] > 100 && corner.point[0] < 300);
  // An aim point outside the rectangle is brought to its edge first, so the answer is always inside.
  const out = studioHoldInRect([900, 250], [2300, 250], rect);
  assert.ok(out.point[0] <= 500 && out.point[0] >= 100);
  // A rectangle with no room gives the point back unchanged.
  assert.deepEqual(studioHoldInRect([0, 0], [9, 9], { left: 5, top: 5, right: 5, bottom: 5 }), { point: [9, 9], held: false });
});
