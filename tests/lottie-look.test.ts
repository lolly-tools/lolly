// SPDX-License-Identifier: MPL-2.0
/**
 * dotLottie for the appearance keyframes (plans/328): native animated fill and stroke
 * colour, stroke width, corner radius and trim on a Design shape layer, refused by name
 * where Lottie cannot carry them, and no change at all for a layer that keys none.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockHost } from '@lolly-tools/core';
import type { ExportOpts, HostV1 } from '../engine/src/bridge/host-v1.ts';
import { exportDesignLottie } from '../engine/src/design-lottie.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import type { LottieObject } from '../engine/src/lottie-model.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { serialiseKf } from '../engine/src/keyframes.ts';
import { kfColourKey, kfOklabToSrgb8, kfOutlinePath } from '../engine/src/kf-look.ts';
import { lottieOutline } from '../engine/src/lottie-look.ts';

function host(): HostV1 {
  const h = createMockHost();
  h.geom = makeGeomApi();
  return h;
}
const opts = (boxes: Record<string, unknown>[]): ExportOpts =>
  ({ width: 400, height: 300, sourceDocument: { toolId: 'design', values: { background: 'transparent', projectFps: 30, boxes } } });
async function lottie(boxes: Record<string, unknown>[]) {
  return readLottie(new Uint8Array(await (await exportDesignLottie(opts(boxes), host())).arrayBuffer())).animations[0]!.animation;
}
const shapesOf = (a: LottieObject, name: string): LottieObject[] =>
  ((a.layers as LottieObject[]).find((l) => l.nm === name)!.shapes as LottieObject[]);

const RED = kfColourKey('#ff0000', 'fill')!;
const BLUE = kfColourKey('#0000ff', 'fill')!;

test('a layer that keys no appearance exports exactly as before', async () => {
  const box = { id: 'b', name: 'b', kind: 'box', shape: 'rounded', radius: 10, x: 10, y: 10, w: 100, h: 60, bg: '#ff0000', stroke: '#000', strokeW: 4, start: 0, dur: 2 };
  const plain = await lottie([box]);
  const moved = await lottie([{ ...box, kf: 't0_x0*t1000_x50' }]);
  assert.deepEqual(shapesOf(moved, 'b'), shapesOf(plain, 'b'), 'a position track leaves the shapes alone');
});

test('a fill colour is sampled per frame in OKLab, and every sample is the editor\'s colour', async () => {
  const kf = serialiseKf([{ t: 0, ease: 'el', v: RED }, { t: 1000, v: BLUE }]);
  const a = await lottie([{ id: 'b', name: 'b', kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 60, bg: '#ff0000', start: 0, dur: 2, kf }]);
  const fill = shapesOf(a, 'b').find((s) => s.ty === 'fl')!;
  const c = fill.c as { a: number; k: { t: number; s: number[] }[] };
  assert.equal(c.a, 1, 'animated');
  assert.equal(c.k.length, 31, 'one key per frame of the one-second move at 30 fps');
  const mid = c.k[15]!;
  assert.equal(mid.t, 15);
  const want = kfOklabToSrgb8((RED.cl! + BLUE.cl!) / 2, (RED.ca! + BLUE.ca!) / 2, (RED.cb! + BLUE.cb!) / 2).map((n) => n / 255);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(mid.s[i]! - want[i]!) < 1e-3, `channel ${i}`);
  assert.notDeepEqual(mid.s.slice(0, 3).map((n) => Math.round(n * 255)), [128, 0, 128], 'not the sRGB blend');
});

test('stroke width and trim keep their curves; a trim reaches the stroke only', async () => {
  const kf = serialiseKf([{ t: 0, ease: 'eo', v: { lw: 2, ts: 0, te: 0 } }, { t: 1500, v: { lw: 8, te: 1 } }]);
  const a = await lottie([{ id: 'p', name: 'p', kind: 'path', path: '1!line!0_0!0_1!1', x: 0, y: 0, w: 200, h: 100, stroke: '#123456', strokeW: 2, start: 0, dur: 2, kf }]);
  const shapes = shapesOf(a, 'p');
  assert.deepEqual(shapes.map((s) => s.ty), ['gr'], 'a line with no fill is one stroke group');
  const it = shapes[0]!.it as LottieObject[];
  assert.deepEqual(it.map((s) => s.ty), ['sh', 'tm', 'st', 'tr']);
  const tm = it[1]!;
  const e = tm.e as { a: number; k: { t: number; s: number[]; o?: { x: number } }[] };
  assert.equal(e.a, 1);
  assert.deepEqual(e.k.map((k) => [k.t, k.s[0]]), [[0, 0], [45, 100]], 'trim end in percent, at frame times');
  assert.equal(e.k[0]!.o?.x, 0.33, 'the ease-out curve travels with it');
  const w = (it[2]!.w as { k: { s: number[] }[] }).k.map((k) => k.s[0]);
  assert.deepEqual(w, [2, 8]);
});

test('a filled path keeps its fill whole and trims a separate stroke group', async () => {
  const kf = serialiseKf([{ t: 0, v: { te: 0 } }, { t: 1000, v: { te: 1 } }]);
  const a = await lottie([{ id: 'p', name: 'p', kind: 'path', path: '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5', x: 0, y: 0, w: 100, h: 100, bg: '#ff0000', stroke: '#000000', strokeW: 3, start: 0, dur: 2, kf }]);
  const groups = shapesOf(a, 'p');
  assert.deepEqual(groups.map((g) => g.nm), ['Fill', 'Stroke']);
  assert.deepEqual((groups[0]!.it as LottieObject[]).map((s) => s.ty), ['sh', 'fl', 'tr']);
  assert.deepEqual((groups[1]!.it as LottieObject[]).map((s) => s.ty), ['sh', 'tm', 'st', 'tr']);
});

test('a trimmed box shape is stroked along an outline that starts where the editor\'s does', async () => {
  const kf = serialiseKf([{ t: 0, v: { te: 0 } }, { t: 1000, v: { te: 1 } }]);
  const a = await lottie([{ id: 'b', name: 'b', kind: 'box', shape: 'rounded', radius: 20, x: 0, y: 0, w: 120, h: 80, stroke: '#000000', strokeW: 4, start: 0, dur: 2, kf }]);
  const it = shapesOf(a, 'b')[0]!.it as LottieObject[];
  const v = ((it[0]!.ks as LottieObject).k as { v: number[][] }).v;
  // kfOutlinePath('rounded', 120, 80, 20, 2) starts "M20 2H100..." - the same first two points.
  assert.match(kfOutlinePath('rounded', 120, 80, 20, 2), /^M20 2H100/);
  assert.deepEqual(v.slice(0, 2), [[20, 2], [100, 2]]);
  assert.deepEqual(((lottieOutline('ellipse', 100, 60, 0, 0).ks as LottieObject).k as { v: number[][] }).v[0], [100, 30]);
});

test('stroke width and corner radius on a box move its rectangle with them', async () => {
  const kf = serialiseKf([{ t: 0, ease: 'el', v: { lw: 2, cr: 0 } }, { t: 1000, v: { lw: 10, cr: 30 } }]);
  const a = await lottie([{ id: 'b', name: 'b', kind: 'box', shape: 'rounded', radius: 4, x: 0, y: 0, w: 100, h: 60, stroke: '#000000', strokeW: 2, start: 0, dur: 2, kf }]);
  const rc = shapesOf(a, 'b').find((s) => s.ty === 'rc')!;
  const s = rc.s as { k: { t: number; s: number[] }[] };
  assert.deepEqual(s.k.at(-1)!.s, [90, 50], 'inset by the final width');
  const r = rc.r as { k: { s: number[] }[] };
  assert.deepEqual(r.k.at(-1)!.s, [25], 'the radius of the stroke\'s centre line: 30 - 10/2, a one-item array per key');
});

test('an ellipse\'s size follows its keyed stroke width too', async () => {
  const kf = serialiseKf([{ t: 0, ease: 'el', v: { lw: 2 } }, { t: 1000, v: { lw: 12 } }]);
  const a = await lottie([{ id: 'e', name: 'e', kind: 'box', shape: 'ellipse', x: 0, y: 0, w: 100, h: 80, stroke: '#000000', strokeW: 2, start: 0, dur: 2, kf }]);
  const el = shapesOf(a, 'e').find((s) => s.ty === 'el')!;
  assert.deepEqual((el.s as { k: { s: number[] }[] }).k.at(-1)!.s, [88, 68]);
});

test('what dotLottie cannot carry is refused by name', async () => {
  const refuse = async (boxes: Record<string, unknown>[], re: RegExp) => {
    await assert.rejects(exportDesignLottie(opts(boxes), host()), re);
  };
  const colour = serialiseKf([{ t: 0, v: RED }, { t: 500, v: BLUE }]);
  await refuse([{ id: 'n', name: 'n', kind: 'box', shape: 'rect', w: 10, h: 10, stroke: '#000', strokeW: 1, start: 0, dur: 1, kf: colour }],
    /n: a fill colour key on a shape with no fill is not supported by dotLottie export/);
  const trimWidth = serialiseKf([{ t: 0, v: { te: 0, lw: 1 } }, { t: 500, v: { te: 1, lw: 4 } }]);
  await refuse([{ id: 't', name: 't', kind: 'box', shape: 'rect', w: 10, h: 10, stroke: '#000', strokeW: 1, start: 0, dur: 1, kf: trimWidth }],
    /t: a trimmed shape with an animated stroke width is not supported/);
});
