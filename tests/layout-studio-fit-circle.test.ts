/**
 * Layout Studio — text-fit + circle-shape contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * Loads the REAL tool from disk and drives it through the engine with a stub host, so
 * these guard the tool's actual render. Layout Studio ships in two packs — the private
 * brands/suse one and the parent-owned brands/lolly-start one — with byte-identical
 * hooks.js/template.html and only brand differences in tool.json. We load from
 * brands/lolly-start (always present in a public checkout; brands/suse is a private
 * submodule CI skips), so the suite never silently skips.
 *
 * Two features under test (ported from deck-builder's freeform mode):
 *   1. Shrink-to-fit — a box with `fitText:true` marks a data-fit="1" fit root, and the
 *      authored font size is written as `calc(<n>px * var(--fit, 1))` so the template's
 *      fit pass can scale it down with ONE unitless multiplier. Off boxes are untouched.
 *   2. Circle — a shape that renders like an ellipse (border-radius:50%); the editor
 *      keeps it square, but the render path just needs the 50% radius.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// Parent-owned pack — present in every checkout (brands/suse is private + CI-skipped).
const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'layout-studio', 'tool.json')),
  'brands/lolly-start/tools/layout-studio/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('layout-studio', fetchFile);

const boxesField = () => tool.manifest.inputs.find((i: any) => i.id === 'boxes');
const boxSubFields = () => boxesField().fields as any[];
const canvas = () => boxesField().canvas as any;

async function mount(boxes: unknown[]) {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

// ── manifest shape ────────────────────────────────────────────────────────────────

test('the shape select gained a `circle` option (alongside ellipse)', () => {
  const shape = boxSubFields().find(f => f.id === 'shape');
  assert.ok(shape, 'boxes has a `shape` sub-field');
  const values = shape.options.map((o: any) => o.value);
  assert.ok(values.includes('circle'), `shape options include circle (got ${values.join(',')})`);
  assert.ok(values.includes('ellipse'), 'ellipse is still there');
});

test('a `circle` add-kind exists and seeds a square box', () => {
  const kind = (canvas().addKinds as any[]).find(k => k.id === 'circle');
  assert.ok(kind, 'canvas.addKinds has a circle entry');
  assert.equal(kind.seed.shape, 'circle');
  assert.equal(kind.seed.kind, 'box', 'a circle is a box with a circle shape');
  assert.equal(kind.seed.w, kind.seed.h, 'the seed is square');
});

test('a `fitText` boolean field exists (default off) and is LAST in the wire order', () => {
  const fields = boxSubFields();
  const fit = fields.find(f => f.id === 'fitText');
  assert.ok(fit, 'boxes has a `fitText` sub-field');
  assert.equal(fit.type, 'boolean');
  assert.equal(fit.default, false, 'off by default — grow-to-fit stays the norm');
  // Compact block URLs encode fields positionally, so a new field MUST be appended last,
  // never inserted mid-array (that would shift every later field's slot). Guard it.
  assert.equal(fields[fields.length - 1].id, 'fitText', 'fitText is the final field (wire order locked)');
});

test('canvas config maps fitTextField → fitText', () => {
  assert.equal(canvas().fitTextField, 'fitText');
});

// ── render: text fit ────────────────────────────────────────────────────────────────

test('every text size is written as calc(<n>px * var(--fit, 1)) so the fit pass can scale it', async () => {
  const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 400, h: 200, text: 'Hi', fontSize: 72 }]);
  assert.match(html, /font-size:calc\(72px \* var\(--fit, 1\)\)/, 'authored size rides through --fit');
});

test('fitText:true marks the box as a fit root (data-fit="1"); off boxes are not', async () => {
  const html = await mount([
    { id: 'on', kind: 'text', x: 0, y: 0, w: 400, h: 200, text: 'shrink me', fontSize: 120, fitText: true },
    { id: 'off', kind: 'text', x: 0, y: 300, w: 400, h: 200, text: 'grow me', fontSize: 40 },
  ]);
  assert.match(html, /data-box-id="on"[^>]*data-fit="1"/, 'the opted-in box is a fit root');
  assert.match(html, /data-box-id="off"[^>]*data-fit=""/, 'the default box is NOT a fit root');
});

test('the shrink-to-fit template <script> ships in the render (the DOM measurement pass)', async () => {
  const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 400, h: 200, text: 'Hi', fitText: true }]);
  assert.match(html, /<script>/, 'the fit pass is present');
  assert.match(html, /\.lolly-box\[data-fit="1"\]/, 'it targets opted-in fit roots only');
  assert.match(html, /--fit/, 'it drives the --fit multiplier');
});

// ── render: circle ───────────────────────────────────────────────────────────────────

test('a circle box renders border-radius:50% (identical to an ellipse)', async () => {
  const html = await mount([
    { id: 'c', kind: 'box', x: 0, y: 0, w: 300, h: 300, shape: 'circle', bg: '#30BA78' },
    { id: 'e', kind: 'box', x: 0, y: 400, w: 300, h: 200, shape: 'ellipse', bg: '#123456' },
  ]);
  assert.match(html, /data-box-id="c"[^>]*style="[^"]*border-radius:50%/, 'circle → 50%');
  assert.match(html, /data-box-id="e"[^>]*style="[^"]*border-radius:50%/, 'ellipse → 50% too');
});

test('a rectangle is unaffected — still border-radius:0 (no fit calc regression on default boxes)', async () => {
  const html = await mount([{ id: 'r', kind: 'box', x: 0, y: 0, w: 300, h: 300, shape: 'rect', bg: '#000' }]);
  assert.match(html, /data-box-id="r"[^>]*style="[^"]*border-radius:0/, 'rect → 0');
});
