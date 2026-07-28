// SPDX-License-Identifier: MPL-2.0
/**
 * Pen shapes with a WIDE stroke must not be clipped — in any layout editor.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * A path box's frame is the LOWERED curve's tight bbox (`refitFrame` in
 * shells/web/src/views/free-canvas-pen.ts keeps it exactly that, deliberately: fitting
 * the stroke instead would grow the box every time the width changed, and fitting the
 * control hull would make every curved shape's box visibly too big). So a stroke
 * straddles the frame edge and half its width falls OUTSIDE the frame — and the box's
 * inline `<svg>` clips to its own viewport, in the browser AND in the SVG/PDF export
 * walkers. Every tool that hosts the pen therefore has to grow that `<svg>` by the
 * stroke's reach and shift its `viewBox` to match, or a stroked pen shape loses half its
 * outline all the way round. Sequence Studio shipped without the pad (a stale fork of
 * `pathHtmlFor` from before it landed), which is the bug these tests close.
 *
 * The tools are driven through the REAL engine with the REAL `host.geom`, so what is
 * asserted is the markup the browser and the CLI actually get — not a paraphrase of it.
 * Both hosts of the pen are covered by ONE table, because the pad is a property of the
 * pen contract rather than of either tool: a third editor added later belongs here too.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const geom = makeGeomApi();

/**
 * The pen's hosts. `layout-studio` is loaded from brands/lolly-start (parent-owned and
 * present in every checkout — brands/suse is a private submodule CI skips, and its copy
 * of hooks.js is byte-identical in this region); `sequence-studio` from the public
 * community pack.
 */
const HOSTS = [
  { id: 'layout-studio', dir: join(ROOT, 'brands', 'lolly-start', 'tools') },
  { id: 'sequence-studio', dir: join(ROOT, 'community') },
] as const;

for (const h of HOSTS) {
  assert.ok(existsSync(join(h.dir, h.id, 'tool.json')),
    `${h.id}/tool.json is missing under ${h.dir} — the tool was renamed or deleted`);
}

const W = 200, H = 100;

/**
 * An authored path field value: a diagonal across the whole frame, in the wire codec the
 * tool's `hooks.js` decodes. Encoded through the BRIDGE rather than hand-written, so the
 * fixture cannot drift from the grammar. Nodes are fractions of the frame, so 0→1 spans
 * it — i.e. the curve touches all four frame edges, which is what a refitted frame looks
 * like and what makes a missing pad clip.
 */
const PATH = (() => {
  const enc = geom.encodeAuthored({
    kind: 'hyperbezier',
    nodes: [{ x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 1, continuity: 'corner' }],
    closed: false,
  });
  assert.ok(enc.ok, `the fixture path encodes: ${JSON.stringify(enc)}`);
  return enc.value as string;
})();

/** Mount one host tool with a single path box, and return its hydrated markup. */
async function mount(hostTool: (typeof HOSTS)[number], box: Record<string, unknown>): Promise<string> {
  const fetchFile = (path: string) => readFile(join(hostTool.dir, path), 'utf8');
  const tool: any = await loadTool(hostTool.id, fetchFile);
  const rt = await createRuntime(tool, baseHost({ geom }), {
    boxes: [{
      id: 'p1', kind: 'path', x: 10, y: 20, w: W, h: H, path: PATH,
      bg: '', opacity: 100, ...box,
    }] as never,
  });
  assert.deepEqual(rt.hookErrors ?? [], [], `${hostTool.id}: no hook errors`);
  return rt.getHydrated() as string;
}

/** The path box's `<svg>` attributes, as the renderers read them. */
interface PathSvg { width: number; height: number; vb: number[]; style: string }
function pathSvg(html: string, who: string): PathSvg {
  const tag = /<svg class="lolly-box-path"[^>]*>/.exec(html)?.[0];
  assert.ok(tag, `${who}: the path box emitted an <svg> — got: ${html.slice(0, 400)}`);
  const attr = (name: string): string => new RegExp(`${name}="([^"]*)"`).exec(tag!)?.[1] ?? '';
  return {
    width: Number(attr('width')),
    height: Number(attr('height')),
    vb: attr('viewBox').trim().split(/\s+/).map(Number),
    style: attr('style'),
  };
}

/** The style attribute of the box DIV (the `<svg>`'s parent). */
const boxStyle = (html: string): string =>
  /<div class="lolly-box[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';

for (const h of HOSTS) {
  test(`${h.id}: a wide stroke grows the path <svg> by half its width on every side`, async () => {
    const sw = 40;
    const svg = pathSvg(await mount(h, { stroke: '#30ba78', strokeW: sw }), h.id);
    const pad = sw / 2;   // a round cap and a round join each reach exactly half the width
    assert.equal(svg.width, W + pad * 2, 'width grown by the stroke reach');
    assert.equal(svg.height, H + pad * 2, 'height grown by the stroke reach');
    // The viewBox is shifted to match, which is the half that keeps the geometry put:
    // path coordinates still map to 0..w / 0..h, so the shape does not move or scale.
    assert.deepEqual(svg.vb, [-pad, -pad, W + pad * 2, H + pad * 2], 'viewBox shifted, not rescaled');
    // …and the element is pulled back by the same amount, overriding styles.css's
    // `inset: 0; width/height: 100%` (which would otherwise re-pin it to the frame).
    assert.match(svg.style, /inset:auto/, 'the stylesheet pin is overridden');
    assert.match(svg.style, new RegExp(`left:-${pad}px`), `left:-${pad}px`);
    assert.match(svg.style, new RegExp(`top:-${pad}px`), `top:-${pad}px`);
    assert.match(svg.style, new RegExp(`width:${W + pad * 2}px`), 'inline width matches the viewport');
    assert.match(svg.style, new RegExp(`height:${H + pad * 2}px`), 'inline height matches the viewport');
  });

  test(`${h.id}: the box div does not re-clip the padded <svg>`, async () => {
    // .lolly-box clips its children (right for an image or text, wrong for a pen shape).
    // Inline rather than in styles.css so the CLI and the export walkers, which read this
    // string, agree with the browser.
    const style = boxStyle(await mount(h, { stroke: '#30ba78', strokeW: 40 }));
    assert.match(style, /overflow:visible/, `${h.id}: a path box's frame does not clip: ${style}`);
  });

  test(`${h.id}: no stroke means no pad — the frame IS the shape`, async () => {
    for (const box of [
      { stroke: '', strokeW: 40, bg: '#30ba78' },   // filled only: nothing paints outside
      { stroke: '#30ba78', strokeW: 0 },            // a stroke colour with no width
    ]) {
      const svg = pathSvg(await mount(h, box), h.id);
      assert.equal(svg.width, W, `unpadded width (${JSON.stringify(box)})`);
      assert.equal(svg.height, H, `unpadded height (${JSON.stringify(box)})`);
      assert.deepEqual(svg.vb, [0, 0, W, H], `unshifted viewBox (${JSON.stringify(box)})`);
      // No inline geometry either: the stylesheet's `inset: 0` is exactly right here, and
      // emitting a redundant override would put a second source of truth in the markup.
      assert.equal(svg.style, '', `no inline geometry (${JSON.stringify(box)})`);
    }
  });
}

/**
 * Layout Studio also ships the stroke DECORATIONS, and two of them reach further than
 * half the width — a pad that is merely usually right is a clipped outline the user
 * cannot explain. Sequence Studio hard-codes round/round (it has no such sub-fields), so
 * this claim is Layout Studio's alone rather than part of the table above.
 */
test('layout-studio: a square cap and a miter join size the pad up for themselves', async () => {
  const h = HOSTS[0];
  const sw = 40;
  // A square cap's corner sits sw/2 along the tangent AND sw/2 across it: sw/2·√2.
  const square = pathSvg(await mount(h, { stroke: '#30ba78', strokeW: sw, strokeCap: 'square' }), 'square cap');
  const squarePad = (Math.SQRT2 / 2) * sw;
  assert.ok(Math.abs(square.width - (W + squarePad * 2)) < 0.02, `square cap pad: got ${square.width}`);
  // A miter spike is bounded by stroke-miterlimit · sw/2, and the limit is emitted
  // explicitly precisely so that bound is a fact rather than a per-renderer default.
  const html = await mount(h, { stroke: '#30ba78', strokeW: sw, strokeJoin: 'miter' });
  const limit = Number(/stroke-miterlimit="([\d.]+)"/.exec(html)?.[1]);
  assert.ok(Number.isFinite(limit), `the miter limit is stated in the markup: ${html.slice(0, 400)}`);
  const miter = pathSvg(html, 'miter join');
  assert.equal(miter.width, W + (limit / 2) * sw * 2, `miter pad is limit/2 · sw (limit ${limit})`);
});
