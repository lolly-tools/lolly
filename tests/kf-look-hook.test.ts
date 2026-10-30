// SPDX-License-Identifier: MPL-2.0
/**
 * The Design renderer's half of the appearance keyframes (plans/328): what a box whose
 * track keys fill, stroke, stroke width, corner radius or trim is rendered as, and the
 * promise that a box whose track keys none of them is rendered exactly as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { serialiseKf } from '../engine/src/keyframes.ts';
import { KF_LOOK_VARS, kfColourKey, kfOutlinePath } from '../engine/src/kf-look.ts';
import { baseHost } from './helpers/host.ts';
import { LEGACY_CORPUS } from './fixtures/kf-look-corpus.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const tool: any = await loadTool('design', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));

async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost({ geom: makeGeomApi() }), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

/** One box's whole element, opening tag to the matching close, by its id. */
function boxHtml(html: string, id: string): string {
  const at = html.indexOf(`data-box-id="${id}"`);
  assert.ok(at >= 0, `box ${id} rendered`);
  const start = html.lastIndexOf('<div', at);
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + 6);
  }
  throw new Error('unbalanced box markup');
}

test('a document with no appearance keys renders byte for byte as it did before them', async () => {
  // The digest is the markup the renderer wrote for this corpus BEFORE plans/328 (engine
  // 1.289, commit 2980bd377), measured with that hook. Every legacy channel, every
  // stroke placement and both box kinds are in the corpus, so any change the new
  // channels make to a box that does not key them shows up here.
  const html = await mount(LEGACY_CORPUS);
  assert.equal(createHash('sha256').update(html).digest('hex'),
    'f60a32c56e480bb373b2cae92b5030f23c666c658eee94d3821666910c65b38f');
  assert.equal(html.includes('--lolly-kf-'), false);
});

const fill0 = kfColourKey('#ff0000', 'fill')!;
const fill1 = kfColourKey('#0000ff', 'fill')!;
const ink0 = kfColourKey('#000000', 'stroke')!;
const ink1 = kfColourKey('#ffffff', 'stroke')!;

test('a box that keys its fill, stroke, width and radius paints them through custom properties', async () => {
  const kf = serialiseKf([
    { t: 0, v: { ...fill0, ...ink0, lw: 2, cr: 0 } },
    { t: 1000, v: { ...fill1, ...ink1, lw: 8, cr: 30 } },
  ]);
  const html = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 200, h: 100, shape: 'rounded', radius: 10,
    bg: '#ffcc00', stroke: '#123456', strokeW: 4, start: 0, dur: 2, kf }]), 'b');
  assert.match(html, /background:var\(--lolly-kf-fill, #ffcc00\);/);
  assert.match(html, /border-radius:var\(--lolly-kf-r, 10px\);/);
  assert.match(html, /border-style:solid;border-color:var\(--lolly-kf-stroke, #123456\);border-width:var\(--lolly-kf-sw, 4px\);/);
  assert.equal(KF_LOOK_VARS.fill, '--lolly-kf-fill');
  assert.equal(KF_LOOK_VARS.stroke, '--lolly-kf-stroke');
  assert.equal(KF_LOOK_VARS.width, '--lolly-kf-sw');
  assert.equal(KF_LOOK_VARS.radius, '--lolly-kf-r');
});

test('per-side widths follow a keyed width in proportion; an outside stroke keeps its own width', async () => {
  const kf = serialiseKf([{ t: 0, v: { lw: 2 } }, { t: 1000, v: { lw: 6 } }]);
  const sides = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 200, h: 100, shape: 'rect', bg: '#fff',
    stroke: '#000', strokeW: 4, strokeTop: 8, strokeLeft: 0, start: 0, dur: 2, kf }]), 'b');
  assert.match(sides, /border-width:calc\(var\(--lolly-kf-sw, 4px\) \* 2\) calc\(var\(--lolly-kf-sw, 4px\) \* 1\) calc\(var\(--lolly-kf-sw, 4px\) \* 1\) calc\(var\(--lolly-kf-sw, 4px\) \* 0\);/);
  const outside = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 200, h: 100, shape: 'rect', bg: '#fff',
    stroke: '#000', strokeW: 4, strokeAlign: 'outside', start: 0, dur: 2, kf }]), 'b');
  assert.equal(outside.includes('--lolly-kf-sw'), false, 'a stroke that grows the box is left at its width');
});

test('a grown box keys its radius with the stroke outset added', async () => {
  const kf = serialiseKf([{ t: 0, v: { cr: 0 } }, { t: 1000, v: { cr: 20 } }]);
  const html = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 200, h: 100, shape: 'rounded', radius: 8,
    bg: '#fff', stroke: '#000', strokeW: 6, strokeAlign: 'center', start: 0, dur: 2, kf }]), 'b');
  assert.match(html, /border-radius:calc\(var\(--lolly-kf-r, 8px\) \+ 3px\);/);
});

test('a pen path keys fill, stroke and width on its own <path> and pads for the widest width', async () => {
  const kf = serialiseKf([{ t: 0, v: { ...fill0, ...ink0, lw: 4 } }, { t: 1000, v: { ...fill1, ...ink1, lw: 24 } }]);
  const html = boxHtml(await mount([{ id: 'p', kind: 'path', x: 0, y: 0, w: 200, h: 200, bg: '#30ba78', stroke: '#11141f',
    strokeW: 4, path: '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5', start: 0, dur: 2, kf }]), 'p');
  assert.match(html, /style="fill:var\(--lolly-kf-fill, #30ba78\);stroke:var\(--lolly-kf-stroke, #11141f\);stroke-width:var\(--lolly-kf-sw, 4px\);"/);
  // Round cap and join reach half the width: the 24 px key pads by 12, not by 2.
  assert.match(html, /viewBox="-12 -12 224 224"/);
});

test('a trimmed pen path draws its stroke per contour over a pathLength of 1, with no arrowheads', async () => {
  const kf = serialiseKf([{ t: 0, v: { ts: 0, te: 0 } }, { t: 1000, v: { te: 1 } }]);
  const line = '1!line!0_0!0_1!1';
  const html = boxHtml(await mount([{ id: 'p', kind: 'path', x: 0, y: 0, w: 300, h: 100, stroke: '#ff0055', strokeW: 5,
    strokeDash: 'dashed', path: line, start: 0, dur: 2, kf }]), 'p');
  assert.match(html, /<path class="lolly-trim" d="[^"]+" pathLength="1" fill="none"/);
  assert.match(html, /stroke-dasharray:var\(--lolly-kf-trim, none\);stroke-dashoffset:var\(--lolly-kf-trim-off, 0\);/);
  assert.match(html, /stroke-width:calc\(5px \* var\(--lolly-kf-trim-on, 1\)\);/);
  assert.equal(/stroke-dasharray="/.test(html), false, 'the dash pattern is set aside while the path is trimmed');
  // Arrowheads and a trim do not mix: the heads keep the line whole.
  const headed = boxHtml(await mount([{ id: 'p', kind: 'path', x: 0, y: 0, w: 300, h: 100, stroke: '#ff0055', strokeW: 5,
    headEnd: 'triangle', path: line, start: 0, dur: 2, kf }]), 'p');
  assert.equal(headed.includes('lolly-trim'), false);
});

test('a trimmed box shape draws its outline as an SVG path in place of the border', async () => {
  const kf = serialiseKf([{ t: 0, v: { te: 0 } }, { t: 1000, v: { te: 1 } }]);
  const html = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 200, h: 100, shape: 'rounded', radius: 16,
    bg: '#eeeeee', stroke: '#222222', strokeW: 4, start: 0, dur: 2, kf }]), 'b');
  assert.match(html, /padding:4px;/);
  assert.equal(/border(-style)?:[^;]*solid/.test(html), false, 'no CSS border is drawn');
  const d = /<svg class="lolly-box-trim"[^>]*><path d="([^"]+)" pathLength="1"/.exec(html)?.[1];
  assert.equal(d, kfOutlinePath('rounded', 200, 100, 16, 2), 'the hook draws the engine outline');
  assert.match(html, /data-trim-shape="rounded" data-trim-r="16" data-trim-sw="4"/);
  for (const shape of ['rect', 'pill', 'ellipse', 'circle']) {
    const h2 = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 120, h: 80, shape, bg: '#eee',
      stroke: '#222', strokeW: 2, start: 0, dur: 2, kf }]), 'b');
    const d2 = /<svg class="lolly-box-trim"[^>]*><path d="([^"]+)"/.exec(h2)?.[1];
    assert.equal(d2, kfOutlinePath(shape, 120, 80, 0, 1), shape);
  }
  // An outside stroke, per-side widths or a picture keep the border: no outline is drawn.
  for (const extra of [{ strokeAlign: 'outside' }, { strokeTop: 9 }, { image: 'lolly/logo/primary' }]) {
    const h3 = boxHtml(await mount([{ id: 'b', kind: 'box', x: 0, y: 0, w: 120, h: 80, shape: 'rect', bg: '#eee',
      stroke: '#222', strokeW: 2, start: 0, dur: 2, kf, ...extra }]), 'b');
    assert.equal(h3.includes('lolly-box-trim'), false, JSON.stringify(extra));
  }
});

test('a frame never carries appearance markup', async () => {
  const kf = serialiseKf([{ t: 0, v: fill0 }, { t: 1000, v: fill1 }]);
  const html = await mount([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, bg: '#ffffff', kf }]);
  assert.equal(html.includes('--lolly-kf-'), false);
});
