// SPDX-License-Identifier: MPL-2.0
/**
 * Design - gradient-fill contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Drives the REAL tool through the engine, so these guard the actual render rather than
 * a paraphrase of it. Loaded from community/ (public, present in every
 * checkout; brands/suse is a private submodule CI skips) - but the SAME edit ships in
 * both packs, and the manifest test below asserts the wire slot that has to match.
 *
 * The two host shapes are both the point:
 *
 *   - WITH `host.color` (the engine's real makeColorApi): the box gets a
 *     `background-image` whose stops were interpolated in OKLab and baked down to plain
 *     sRGB by the engine, so an SVG/PDF export - neither of which can read
 *     `linear-gradient(in oklab, …)` - paints the same thing the browser does.
 *   - WITHOUT it (the bare baseHost): `host.color.gradientCss` is an OPTIONAL v1.68
 *     bridge method and the tool declares `engineVersion: ^1.12.0`, so an older host is
 *     legal and MUST degrade to the flat fill instead of throwing or leaking the raw
 *     spec into a style attribute.
 *
 * See plans/60-color-spaces.md section 10 and engine/CHANGELOG.md 1.68.0.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { baseHost } from './helpers/host.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);
const boxesField = () => tool.manifest.inputs.find((i: any) => i.id === 'boxes');
const boxSubFields = () => boxesField().fields as any[];

/** Mount the real tool. `withColor` decides whether the optional bridge method exists. */
async function mount(boxes: unknown[], withColor = true): Promise<string> {
  const host = withColor ? baseHost({ color: makeColorApi() }) : baseHost();
  const rt = await createRuntime(tool, host, { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

const BOX = {
  id: 'g1', kind: 'box', x: 0, y: 0, w: 400, h: 300, shape: 'rect', bg: '#eeeeee', opacity: 100,
};
// The style attribute of the first .lolly-box in the hydrated markup.
const boxStyle = (html: string): string =>
  /<div class="lolly-box[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';

// ── manifest shape ───────────────────────────────────────────────────────────

test('a `grad` text field exists and holds wire slot 52', () => {
  const fields = boxSubFields();
  const grad = fields.find(f => f.id === 'grad');
  assert.ok(grad, 'boxes has a `grad` sub-field');
  assert.equal(grad.type, 'text');
  assert.equal(grad.default, '');
  // Compact block URLs encode fields POSITIONALLY, so a new field can only be
  // APPENDED - inserting one mid-array shifts every column of every link already
  // shared. `grad` was the 53rd field when it landed and must stay the 53rd forever.
  assert.equal(fields.indexOf(grad), 52, 'grad moved slot (wire order is locked)');
});

test('the canvas config points the editor at the field', () => {
  assert.equal((boxesField().canvas as any).gradField, 'grad');
});

// ── rendering, with the bridge present ───────────────────────────────────────

test('a gradient spec becomes a background-image with OKLab-baked sRGB stops', async () => {
  const style = boxStyle(await mount([{ ...BOX, grad: 'lin_90_30ba78-0_efefef-100' }]));
  assert.match(style, /background-image:linear-gradient\(90deg, /, `got: ${style}`);
  // The authored ends are present verbatim…
  assert.ok(style.includes('#30ba78 0%'), 'first stop verbatim');
  assert.ok(style.includes('#efefef 100%'), 'last stop verbatim');
  // …and at least one stop was BAKED in between (this pair needs one at 50%). Without
  // it, an SVG/PDF renderer's sRGB interpolation would grey out the middle.
  const stops = style.match(/#[0-9a-f]{6,8} [\d.]+%/g) ?? [];
  assert.ok(stops.length >= 3, `baked an intermediate stop (got ${stops.length}: ${stops.join(', ')})`);
  // No interpolation-space keyword - that is the whole point of baking.
  assert.ok(!/\bin oklab\b/.test(style), 'no `in oklab` (SVG/PDF cannot read it)');
});

test('the flat fill stays UNDER the gradient, so a translucent stop composites on it', async () => {
  const style = boxStyle(await mount([{ ...BOX, bg: '#123456', grad: 'lin_90_30ba7880-0_efefef-100' }]));
  // Order matters: `background:` is a shorthand that RESETS background-image, so the
  // gradient has to come after it.
  const bg = style.indexOf('background:#123456');
  const img = style.indexOf('background-image:');
  assert.ok(bg >= 0, `flat fill kept: ${style}`);
  assert.ok(img > bg, 'background-image comes after the background shorthand');
  assert.ok(style.includes('#30ba7880 0%'), 'the translucent stop survives as 8-digit hex');
});

test('every gradient kind emits its own CSS primitive', async () => {
  for (const [spec, re] of [
    ['lin_45_ff0000-0_0000ff-100', /background-image:linear-gradient\(45deg, /],
    ['rad_0_ff0000-0_0000ff-100', /background-image:radial-gradient\(ellipse farthest-corner at 50% 50%, /],
    ['con_45_ff0000-0_0000ff-100', /background-image:conic-gradient\(from 45deg at 50% 50%, /],
  ] as Array<[string, RegExp]>) {
    assert.match(boxStyle(await mount([{ ...BOX, grad: spec }])), re, spec);
  }
});

test('the interpolation space is honoured — sRGB emits only the authored stops', async () => {
  const smooth = boxStyle(await mount([{ ...BOX, grad: 'lin_90_000000-0_ffffff-100' }]));
  const muddy = boxStyle(await mount([{ ...BOX, grad: 'lin.srgb_90_000000-0_ffffff-100' }]));
  const count = (s: string): number => (s.match(/#[0-9a-f]{6,8} [\d.]+%/g) ?? []).length;
  assert.ok(count(smooth) > 2, `OKLab black→white needs baking (got ${count(smooth)})`);
  assert.equal(count(muddy), 2, 'sRGB needs none — the renderer already agrees');
});

// ── degrading, and refusing to leak ──────────────────────────────────────────

test('no host.color: the box renders its flat fill instead of throwing', async () => {
  const style = boxStyle(await mount([{ ...BOX, grad: 'lin_90_30ba78-0_efefef-100' }], false));
  assert.ok(style.includes('background:#eeeeee'), `flat fill still painted: ${style}`);
  assert.ok(!style.includes('background-image'), 'no gradient on an older host');
  assert.ok(!style.includes('lin_90'), 'and the raw spec never reaches the style attribute');
});

test('an unreadable spec paints nothing extra and never leaks into the style', async () => {
  for (const bad of ['garbage', 'lin', 'lin_90_onlystop-0', 'red;background:url(//evil)', '  ']) {
    const style = boxStyle(await mount([{ ...BOX, grad: bad }]));
    assert.ok(!style.includes('background-image'), `${JSON.stringify(bad)} paints no gradient`);
    assert.ok(!style.includes('evil') && !style.includes('url('), `${JSON.stringify(bad)} injects nothing`);
    assert.ok(style.includes('background:#eeeeee'), `${JSON.stringify(bad)} keeps the flat fill`);
  }
});

test('a path box ignores `grad` — its fill is the path, not the div behind it', async () => {
  const style = boxStyle(await mount([
    { ...BOX, kind: 'path', path: 'M0,0L100,100', grad: 'lin_90_30ba78-0_efefef-100' },
  ]));
  assert.ok(!style.includes('background-image'),
    `a path box paints no div gradient: ${style}`);
});

test('an empty spec is simply no gradient (the default state)', async () => {
  for (const empty of ['', null, undefined]) {
    const style = boxStyle(await mount([{ ...BOX, grad: empty }]));
    assert.ok(!style.includes('background-image'), `${JSON.stringify(empty)} → no gradient`);
  }
});
