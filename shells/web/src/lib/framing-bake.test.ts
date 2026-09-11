// SPDX-License-Identifier: MPL-2.0
/**
 * The shell's framed-image draw (plans/148 WP-E).
 *
 * `drawFramed` here is the third realisation of one placement: the engine owns
 * the maths, `community/_shared/framing.js` carries the hook-side twin, and this
 * is what the bake and any shell-side composite use. The engine and the hook
 * copy are pinned together by tests/framing.test.ts; this file pins THIS copy to
 * the engine, so a bake can never disagree with the preview it came from.
 *
 * No DOM is needed: drawFramed only ever calls context methods, so a recording
 * stub is a faithful stand-in and the geometry it receives is the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFramed } from './framing-bake.ts';
import { frameRect, framingQuad } from '../../../../engine/src/framing.ts';

interface Call { m: string; a: number[] }

/** A canvas 2-D context that records the calls and tracks the current matrix. */
function stubCtx(): { ctx: CanvasRenderingContext2D; calls: Call[]; draws: Array<{ dst: number[]; mat: number[] }> } {
  const calls: Call[] = [];
  const draws: Array<{ dst: number[]; mat: number[] }> = [];
  let mat = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const mul = (m: number[], n: number[]): number[] => [
    m[0]! * n[0]! + m[2]! * n[1]!, m[1]! * n[0]! + m[3]! * n[1]!,
    m[0]! * n[2]! + m[2]! * n[3]!, m[1]! * n[2]! + m[3]! * n[3]!,
    m[0]! * n[4]! + m[2]! * n[5]! + m[4]!, m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
  ];
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    save() { stack.push([...mat]); },
    restore() { mat = stack.pop() ?? mat; },
    translate(x: number, y: number) { mat = mul(mat, [1, 0, 0, 1, x, y]); },
    rotate(r: number) { mat = mul(mat, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]); },
    transform(a: number, b: number, c: number, d: number, e: number, f: number) { mat = mul(mat, [a, b, c, d, e, f]); },
    drawImage(...a: unknown[]) {
      calls.push({ m: 'drawImage', a: a.slice(1) as number[] });
      draws.push({ dst: (a.slice(-4) as number[]), mat: [...mat] });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, draws };
}

/** Apply a recorded matrix to a point. */
const apply = (m: number[], x: number, y: number): { x: number; y: number } =>
  ({ x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! });

const SRC = {} as CanvasImageSource;

test('drawFramed: a flat framing is ONE drawImage at frameRect\'s rectangle', () => {
  const { ctx, calls, draws } = stubCtx();
  drawFramed(ctx, SRC, 4000, 2250, 800, 1200, { zoom: 160, x: 25, y: 75 }, 'cover');
  assert.equal(calls.length, 1, 'no tile mesh without a tilt');
  const r = frameRect(4000, 2250, 800, 1200, { zoom: 160, x: 25, y: 75 }, 'cover');
  assert.deepEqual(draws[0]!.dst, [r.dx, r.dy, r.dw, r.dh]);
  assert.deepEqual(draws[0]!.mat, [1, 0, 0, 1, 0, 0], 'a flat framing leaves the matrix alone');
});

test('drawFramed: a roll rotates about the pan point, not the frame centre', () => {
  const { ctx, draws } = stubCtx();
  const f = { zoom: 100, x: 20, y: 80, rotate: 30 };
  drawFramed(ctx, SRC, 1000, 1000, 600, 400, f, 'cover');
  const r = frameRect(1000, 1000, 600, 400, f, 'cover');
  // The pan point is the transform's fixed point.
  const fixed = apply(draws[0]!.mat, r.originX, r.originY);
  assert.ok(Math.abs(fixed.x - r.originX) < 1e-9 && Math.abs(fixed.y - r.originY) < 1e-9);
  // …and the frame centre is NOT (which is what "about the pan point" means).
  const centre = apply(draws[0]!.mat, 300, 200);
  assert.ok(Math.hypot(centre.x - 300, centre.y - 200) > 1);
});

test('drawFramed: a tilt draws a mesh whose outer corners land on framingQuad', () => {
  const { ctx, calls, draws } = stubCtx();
  const f = { zoom: 100, x: 50, y: 50, pitch: 12, yaw: -9 };
  drawFramed(ctx, SRC, 1600, 1000, 1080, 1080, f, 'cover');
  assert.ok(calls.length > 1, 'a tilt subdivides - canvas 2-D has no projective transform');
  const quad = framingQuad(1600, 1000, 1080, 1080, f, 'cover');

  // Every tile is drawn in its own space at (0, 0, dw+over, dh+over); the mesh's
  // outermost corners are the projected image corners.
  const pts = draws.map(d => apply(d.mat, 0, 0));
  const near = (p: { x: number; y: number }): number =>
    Math.min(...quad.map(q => Math.hypot(q.x - p.x, q.y - p.y)));
  // The first tile's origin IS the top-left projected corner.
  assert.ok(near(pts[0]!) < 1e-6, 'the first tile starts at the projected top-left');
  // The last tile's far corner reaches the projected bottom-right. Each tile is
  // AFFINE, so its fourth corner is the parallelogram completion of the three
  // projected ones rather than the projected fourth - that difference is the
  // approximation error the subdivision exists to shrink: measured against the
  // exact projection at this pose, 8 tiles is 11.0px out, 16 is 2.9 and the 32
  // this module uses is 0.74. Asserting a sub-pixel bound is the honest claim;
  // demanding exactness would be asserting something canvas 2-D cannot do.
  const last = draws[draws.length - 1]!;
  const farCorner = apply(last.mat, last.dst[2]! - 0.5, last.dst[3]! - 0.5);
  const err = Math.hypot(farCorner.x - quad[2]!.x, farCorner.y - quad[2]!.y);
  assert.ok(err < 1, `the mesh reaches the projected bottom-right within a pixel (off by ${err.toFixed(3)}px)`);
});

test('drawFramed: the tile transform COMPOSES with a matrix the caller already set', () => {
  // A caller may have translated into a panel or scaled for device pixels;
  // replacing the matrix (setTransform) would move every tile out of that space.
  const { ctx, draws } = stubCtx();
  ctx.translate(100, 50);
  drawFramed(ctx, SRC, 1600, 1000, 400, 400, { pitch: 10 }, 'cover');
  const quad = framingQuad(1600, 1000, 400, 400, { pitch: 10 }, 'cover');
  const first = apply(draws[0]!.mat, 0, 0);
  assert.ok(Math.abs(first.x - (quad[0]!.x + 100)) < 1e-6 && Math.abs(first.y - (quad[0]!.y + 50)) < 1e-6);
});
