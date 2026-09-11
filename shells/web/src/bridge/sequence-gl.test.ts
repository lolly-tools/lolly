// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-gl.test.ts - the node-testable half of the P2b GPU compositor (plans/104
 * section 6.4). A real WebGL2 context is a browser-tier concern (the parity harness drives that
 * with `localStorage['lolly.glCompositor'] = '1'` in a real browser); what CAN be pinned
 * here, with no GPU, is the pure MATH that decides whether every tilted quad lands right:
 *
 *   1. `m3ColMajor` - the ROW-major `KfMatrix3` → COLUMN-major GLSL `mat3` transpose.
 *      Getting it wrong silently mirrors/shears every tilted quad, so it is asserted
 *      against the reference reordering directly.
 *   2. THE AFFINE REDUCTION - a JS replica of the vertex shader shows that with
 *      `m3 = null` the unified homography path collapses to `drawItem`'s affine
 *      placement `S·(boxCentre + dx + R·Sc·p)` exactly, which is what makes the untilted
 *      frames of a tilt export match the canvas path.
 *   3. GRACEFUL DEGRADATION - with no canvas/WebGL2 in this realm the probe answers
 *      false and the factory answers null (never throws), which is the fallback the
 *      caller relies on to keep the P2a capture tier reachable.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { KfMatrix3 } from '@lolly/engine';
import {
  m3ColMajor,
  glQuadCompositorSupported,
  createGlQuadCompositor,
} from './sequence-gl.ts';

/** GLSL `mat3 * vec3` for a COLUMN-major array (col0.xyz, col1.xyz, col2.xyz). */
function matVec(m: Float32Array | number[], v: [number, number, number]): [number, number, number] {
  const a = Array.from(m);
  const [x, y, z] = v;
  return [
    a[0]! * x + a[3]! * y + a[6]! * z,
    a[1]! * x + a[4]! * y + a[7]! * z,
    a[2]! * x + a[5]! * y + a[8]! * z,
  ];
}

test('m3ColMajor(null) is the column-major translate matrix', () => {
  // translate(dx,dy) is row-major [1,0,dx, 0,1,dy, 0,0,1] → col-major [1,0,0,0,1,0,dx,dy,1].
  assert.deepEqual(Array.from(m3ColMajor(null, 7, -3)), [1, 0, 0, 0, 1, 0, 7, -3, 1]);
  // …and it maps a point by adding the translation (W stays 1, so no divide).
  const out = matVec(m3ColMajor(null, 7, -3), [10, 20, 1]);
  assert.deepEqual(out, [17, 17, 1]);
});

test('m3ColMajor transposes a row-major KfMatrix3 into column-major, preserving M·v', () => {
  // A concrete homography with a non-trivial w row, so a transpose bug would show.
  const row: KfMatrix3 = [2, 0.5, 30, -0.25, 1.5, 12, 0.001, 0.002, 1];
  const col = m3ColMajor(row, 999, 999);   // dx/dy ignored when m3 is present
  // The reference reordering (mirrors kfMatrix3dCss's column grouping). Compared as a
  // same-typed Float32Array so the comparison is in the uniform's own precision.
  assert.deepEqual(col, new Float32Array([row[0], row[3], row[6], row[1], row[4], row[7], row[2], row[5], row[8]]));
  // The multiply through the col-major uniform must reproduce the ROW-major M·[x,y,1].
  const p: [number, number] = [40, -18];
  const [X, Y, W] = matVec(col, [p[0], p[1], 1]);
  assert.ok(Math.abs(X - (row[0] * p[0] + row[1] * p[1] + row[2])) < 1e-6);
  assert.ok(Math.abs(Y - (row[3] * p[0] + row[4] * p[1] + row[5])) < 1e-6);
  assert.ok(Math.abs(W - (row[6] * p[0] + row[7] * p[1] + row[8])) < 1e-6);
});

test('the affine path reduces to drawItem placement exactly (byte-identity of the untilted frame)', () => {
  // The vertex shader, in JS, for the m3 = null case. `p` is a box-local corner in
  // unscaled px relative to the box centre.
  const shaderDevice = (
    p: [number, number], boxCentre: [number, number], S: number,
    rotDeg: number, scale: number, dx: number, dy: number,
  ): [number, number] => {
    const sc: [number, number] = [p[0] * scale, p[1] * scale];
    const c = Math.cos((rotDeg * Math.PI) / 180);
    const s = Math.sin((rotDeg * Math.PI) / 180);
    const pk: [number, number] = [c * sc[0] - s * sc[1], s * sc[0] + c * sc[1]];
    const [X, Y, W] = matVec(m3ColMajor(null, dx, dy), [pk[0], pk[1], 1]);
    return [S * (boxCentre[0] + X / W), S * (boxCentre[1] + Y / W)];
  };
  // drawItem's affine placement: translate(boxCentre·S + dx·S) · rotate · scale · (p·S).
  const drawItemDevice = (
    p: [number, number], boxCentre: [number, number], S: number,
    rotDeg: number, scale: number, dx: number, dy: number,
  ): [number, number] => {
    const q: [number, number] = [p[0] * S, p[1] * S];
    const sc: [number, number] = [q[0] * scale, q[1] * scale];
    const c = Math.cos((rotDeg * Math.PI) / 180);
    const s = Math.sin((rotDeg * Math.PI) / 180);
    const r: [number, number] = [c * sc[0] - s * sc[1], s * sc[0] + c * sc[1]];
    return [boxCentre[0] * S + dx * S + r[0], boxCentre[1] * S + dy * S + r[1]];
  };
  const boxCentre: [number, number] = [640, 360];
  const S = 2, rot = 17, scale = 1.35, dx = 12, dy = -9;
  for (const p of [[-100, -60], [100, -60], [-100, 60], [100, 60], [0, 0]] as [number, number][]) {
    const a = shaderDevice(p, boxCentre, S, rot, scale, dx, dy);
    const b = drawItemDevice(p, boxCentre, S, rot, scale, dx, dy);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-9, `x @ ${p}: ${a[0]} vs ${b[0]}`);
    assert.ok(Math.abs(a[1] - b[1]) < 1e-9, `y @ ${p}: ${a[1]} vs ${b[1]}`);
  }
});

test('no WebGL2 in this realm ⇒ probe false, factory null (never throws)', () => {
  // node has neither `document` nor a real `OffscreenCanvas` GL backend.
  assert.equal(glQuadCompositorSupported(), false);
  assert.equal(createGlQuadCompositor(1920, 1080), null);
});
