// SPDX-License-Identifier: MPL-2.0
/**
 * The pen's newer gestures, pure half: Shift's angle steps, node snap lines, handle
 * retraction, reversal and resuming from an open end. Expected geometry is worked out
 * here (trigonometry and the engine's own lowering), never read back out of the module.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-pen-ops.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type AuthoredPath, evalCubic } from '@lolly/engine';
import { lowerAuthored } from './free-canvas-pen.ts';
import {
  ANGLE_STEP_DEG, angleNeighbour, constrainAngle, pathToNative, resumableEnd, retractHandles, reversePath, withNodeLines,
} from './free-canvas-pen-ops.ts';

const near = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol;

test('the step is the rotate gesture\'s 15 degrees', () => {
  assert.equal(ANGLE_STEP_DEG, 15);
});

test('constrainAngle lands every pull on a whole number of 15 degree steps', () => {
  const from = { x: 100, y: 100 };
  for (let deg = -180; deg <= 180; deg += 3.7) {
    const r = (deg * Math.PI) / 180;
    const to = { x: from.x + Math.cos(r) * 80, y: from.y + Math.sin(r) * 80 };
    const got = constrainAngle(from, to);
    const angle = (Math.atan2(got.y - from.y, got.x - from.x) * 180) / Math.PI;
    const steps = angle / 15;
    assert.ok(near(steps, Math.round(steps), 1e-6), `${deg} deg came out at ${angle}, not a 15 degree multiple`);
    // The nearest step, so never more than half a step away from the pull.
    let diff = Math.abs(angle - deg) % 360;
    if (diff > 180) diff = 360 - diff;
    assert.ok(diff <= 7.5 + 1e-6, `${deg} deg was moved ${diff} deg, more than half a step`);
  }
});

test('constrainAngle projects, so the point is the nearest one on the stepped ray', () => {
  // 5 degrees off horizontal, 100 long: the projection onto the horizontal ray is cos(5) * 100.
  const r = (5 * Math.PI) / 180;
  const got = constrainAngle({ x: 0, y: 0 }, { x: Math.cos(r) * 100, y: Math.sin(r) * 100 });
  assert.ok(near(got.y, 0), 'exactly horizontal, with no last-bit drift');
  assert.ok(near(got.x, Math.cos(r) * 100, 1e-9), `x ${got.x}`);
  // Straight down stays exactly vertical.
  const down = constrainAngle({ x: 5, y: 5 }, { x: 6, y: 90 });
  assert.equal(down.x, 5);
  assert.ok(down.y > 5);
});

test('constrainAngle leaves a zero-length pull alone', () => {
  assert.deepEqual(constrainAngle({ x: 3, y: 4 }, { x: 3, y: 4 }), { x: 3, y: 4 });
});

test('angleNeighbour picks a still neighbour on the same contour, wrapping on a closed one', () => {
  const parts = [{ count: 3, closed: false }, { count: 4, closed: true }];
  const none = new Set<number>();
  assert.equal(angleNeighbour(parts, 0, none), 1, 'the first node of an open contour measures from the next');
  assert.equal(angleNeighbour(parts, 2, none), 1, 'others measure from the previous');
  assert.equal(angleNeighbour(parts, 3, none), 6, 'a closed contour wraps to its own last node, never to the other contour');
  assert.equal(angleNeighbour(parts, 6, none), 5);
  assert.equal(angleNeighbour(parts, 1, new Set([0])), 2, 'a moving neighbour is skipped');
  assert.equal(angleNeighbour(parts, 1, new Set([0, 2])), -1, 'no still neighbour at all');
  assert.equal(angleNeighbour(parts, 9, none), -1, 'out of range');
});

test('withNodeLines adds node coordinates to the guides the canvas already snaps to', () => {
  const lines = withNodeLines({ x: [10], angled: [{ x: 0, y: 0, rotation: 45 }] }, [{ x: 1, y: 2 }, { x: 3, y: Number.NaN }]);
  assert.deepEqual(lines.x, [10, 1, 3]);
  assert.deepEqual(lines.y, [2]);
  assert.equal(lines.angled?.length, 1, 'authored angled guides ride through');
  assert.deepEqual(withNodeLines(undefined, []), { x: [], y: [] });
});

const curvy: AuthoredPath = {
  kind: 'cubic', closed: false, nodes: [
    { x: 0, y: 0, hOutX: 30, hOutY: -20, continuity: 'corner' },
    { x: 100, y: 0, hInX: -30, hInY: 10, hOutX: 30, hOutY: -10, continuity: 'smooth' },
    { x: 200, y: 50, hInX: -40, hInY: 0 },
  ],
};

test('retractHandles removes the selected handles and turns those nodes into corners', () => {
  const { path, changed } = retractHandles(curvy, ['1:in']);
  assert.equal(changed, 1);
  const n = path.nodes[1]!;
  assert.equal(n.hInX, undefined);
  assert.equal(n.hInY, undefined);
  assert.equal(n.hOutX, 30, 'the other handle stays exactly where it was');
  assert.equal(n.hOutY, -10);
  assert.equal(n.continuity, 'corner', 'a smooth rule would grow the arm back');
  assert.deepEqual(path.nodes[0], curvy.nodes[0], 'other nodes are untouched');
  // The segment into node 1 now arrives with its control point ON the node.
  const seg = lowerAuthored(path).cubics[0]!;
  assert.equal(seg[4], 100);
  assert.equal(seg[5], 0);
});

test('retractHandles ignores keys for handles a node does not have, and bad keys', () => {
  const r = retractHandles(curvy, ['0:in', '2:out', '7:in', 'x:in', '1:sideways']);
  assert.equal(r.changed, 0);
  assert.equal(r.path, curvy, 'nothing changed, so the same path comes back');
});

test('retractHandles takes both handles of one node at once', () => {
  const { path, changed } = retractHandles(curvy, ['1:in', '1:out']);
  assert.equal(changed, 2);
  assert.deepEqual(path.nodes[1], { x: 100, y: 0, continuity: 'corner' });
});

function samplePath(p: AuthoredPath, per = 16): Array<{ x: number; y: number }> {
  return lowerAuthored(p).cubics.flatMap((c) => Array.from({ length: per + 1 }, (_, i) => evalCubic(c, i / per)));
}

test('reversePath walks the same curve backwards', () => {
  const back = reversePath(curvy);
  assert.deepEqual(back.nodes.map((n) => [n.x, n.y]), [[200, 50], [100, 0], [0, 0]]);
  assert.equal(back.nodes[1]!.hInX, 30, 'the old out handle is the new in handle');
  assert.equal(back.nodes[1]!.hOutX, -30);
  const fwd = samplePath(curvy);
  const rev = samplePath(back).reverse();
  assert.equal(fwd.length, rev.length);
  fwd.forEach((p, i) => {
    assert.ok(near(p.x, rev[i]!.x, 1e-9) && near(p.y, rev[i]!.y, 1e-9), `sample ${i} differs`);
  });
  assert.deepEqual(reversePath(back), curvy, 'reversing twice is the identity');
});

test('pathToNative places nodes through the frame and turns handles with it', () => {
  const p: AuthoredPath = { kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0, hOutX: 10, hOutY: 0 }, { x: 100, y: 0 }] };
  const flat = pathToNative(p, { x: 50, y: 60, w: 100, h: 20, rot: 0 });
  assert.deepEqual(flat.nodes[0], { x: 50, y: 60, hOutX: 10, hOutY: 0 });
  assert.deepEqual(flat.nodes[1], { x: 150, y: 60 });
  // 90 degrees clockwise about the frame centre (50, 10) in local px.
  const turned = pathToNative(p, { x: 0, y: 0, w: 100, h: 20, rot: 90 });
  const n0 = turned.nodes[0]!;
  assert.ok(near(n0.x, 60) && near(n0.y, -40), `node 0 at ${n0.x},${n0.y}`);
  assert.ok(near(n0.hOutX!, 0) && near(n0.hOutY!, 10), 'a rightward handle now points down');
});

test('resumableEnd finds an open path\'s ends and nothing else', () => {
  assert.equal(resumableEnd(curvy, 2, 1, 5), 'start');
  assert.equal(resumableEnd(curvy, 199, 52, 5), 'end');
  assert.equal(resumableEnd(curvy, 100, 0, 5), null, 'an interior node is not an end');
  assert.equal(resumableEnd({ ...curvy, closed: true }, 0, 0, 5), null, 'a closed path has no ends');
  const tiny: AuthoredPath = { kind: 'line', closed: false, nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }] };
  assert.equal(resumableEnd(tiny, 1, 0, 5), 'end', 'a tie goes to the end');
  assert.equal(resumableEnd(tiny, 0.5, 0, 5), 'start', 'otherwise the nearer end wins');
});
