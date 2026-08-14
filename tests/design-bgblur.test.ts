// SPDX-License-Identifier: MPL-2.0
/**
 * Layout Studio — box `bgBlur` (BACKGROUND blur / frosted glass) contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * The sibling of design-blur.test.ts, and deliberately a separate file: `blur`
 * blurs the box's own paint (CSS `filter`), `bgBlur` blurs what is painted BEHIND it
 * (CSS `backdrop-filter`). They are separate Penpot attributes too since 2.17 (PR
 * #10034 moved background blur out of `blur` onto its own `backgroundBlur` key and
 * narrowed the `blur` enum to `layer-blur`), and a shape may carry both.
 *
 * Four surfaces:
 *   1. The manifest: `bgBlur` is APPENDED after the stroke dash/gap pair — compact
 *      block URLs encode fields positionally, so the slot is a permanent contract,
 *      and BOTH brand forks have to agree on it.
 *   2. The hooks: `bgBlur > 0` emits both the prefixed and unprefixed
 *      backdrop-filter declarations; absent/0 is byte-identical to before the field
 *      existed (the extras baseline fixture is never regenerated).
 *   3. The engine mapper: `backgroundBlur` {id,type,value,hidden} → node.bgBlur →
 *      box.bgBlur, plus the legacy pre-2.17 `blur:{type:'background-blur'}` form,
 *      coexistence with a layer blur, and the radius mapping constant.
 *   4. penpotGroupToSvg refuses to flatten a subtree carrying it (a standalone SVG
 *      has no way to see a backdrop), so the shape falls to the per-shape import.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  nodeToBox, penpotShapeToNode, penpotGroupToSvg, penpotBackgroundBlurPx,
} from '../engine/src/design-map.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Both brand variants ship the tool; suse is a private submodule public clones skip. */
const BRANDS = (['lolly-start', 'suse'] as const).filter((b) =>
  existsSync(join(ROOT, 'brands', b, 'tools', 'design', 'tool.json')));

const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

const tool: any = await loadTool('design', fetchFile);

async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

const BOX = {
  id: 'b1', kind: 'box', x: 0, y: 0, w: 400, h: 300, shape: 'rect', bg: '#eeeeee', opacity: 100,
};
const boxStyle = (html: string): string =>
  /<div class="lolly-box[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';

const fieldsOf = (brand: string): any[] => JSON.parse(readFileSync(
  join(ROOT, 'brands', brand, 'tools', 'design', 'tool.json'), 'utf8'))
  .inputs.find((i: any) => i.id === 'boxes').fields;

// ── manifest shape ───────────────────────────────────────────────────────────

test('a `bgBlur` number field exists in every mounted brand fork, appended after the stroke pair', () => {
  const slots: number[] = [];
  for (const brand of BRANDS) {
    const fields = fieldsOf(brand);
    const ids = fields.map((f: any) => f.id);
    const bg = fields.find((f: any) => f.id === 'bgBlur');
    assert.ok(bg, `${brand}: boxes has a \`bgBlur\` sub-field`);
    assert.equal(bg.type, 'number', `${brand}: bgBlur type`);
    assert.equal(bg.default, 0, `${brand}: bgBlur default (0 = off, so absent rows are unchanged)`);
    assert.equal(bg.min, 0, `${brand}: bgBlur min`);
    assert.equal(bg.max, 300, `${brand}: bgBlur max (same ceiling as \`blur\`)`);
    assert.deepEqual(bg.showFor, ['box'], `${brand}: v1 is boxes only`);
    assert.equal(ids.filter((v: string) => v === 'bgBlur').length, 1, `${brand}: exactly one bgBlur`);
    // Compact block URLs encode fields POSITIONALLY, so a field can only ever be
    // APPENDED. `blur` holds its historical slot 53, the Penpot dash/gap pair landed
    // at 54/55, and bgBlur is slot 56 — none of them may move again.
    assert.equal(ids.indexOf('blur'), 53, `${brand}: blur moved slot (wire order is locked)`);
    assert.equal(ids.indexOf('strokeDashLen'), 54, `${brand}: strokeDashLen slot`);
    assert.equal(ids.indexOf('strokeGapLen'), 55, `${brand}: strokeGapLen slot`);
    assert.equal(ids.indexOf('bgBlur'), 56, `${brand}: bgBlur slot`);
    slots.push(ids.indexOf('bgBlur'));
  }
  // The two forks share one wire: a box row copied between brands (or a compact URL
  // opened under either) decodes positionally, so a slot mismatch would silently
  // reinterpret the value as a different field.
  assert.equal(new Set(slots).size, Math.min(1, slots.length), 'both forks agree on the slot');
});

// ── rendering through the real hooks ─────────────────────────────────────────

test('bgBlur absent and bgBlur:0 render byte-identically, with no backdrop-filter', async () => {
  const bare = boxStyle(await mount([{ ...BOX }]));
  const zero = boxStyle(await mount([{ ...BOX, bgBlur: 0 }]));
  assert.equal(zero, bare, 'bgBlur:0 is byte-identical to the field being absent');
  assert.ok(!bare.toLowerCase().includes('backdrop-filter'), `no declaration by default: ${bare}`);
});

test('bgBlur:12 emits both the standard and -webkit- backdrop-filter declarations', async () => {
  const style = boxStyle(await mount([{ ...BOX, bgBlur: 12 }]));
  assert.ok(style.includes('backdrop-filter:blur(12px);'), `standard property: ${style}`);
  assert.ok(style.includes('-webkit-backdrop-filter:blur(12px);'), `Safari prefix: ${style}`);
});

test('bgBlur is independent of blur: both can ride the same box', async () => {
  const style = boxStyle(await mount([{ ...BOX, blur: 3, bgBlur: 8 }]));
  assert.ok(style.includes('filter:blur(3px);'), `layer blur still emitted: ${style}`);
  assert.ok(style.includes('backdrop-filter:blur(8px);'), `backdrop blur too: ${style}`);
});

test('a path box never gets a backdrop-filter', async () => {
  // A path box's frame is the curve's tight bbox, so a rectangular frost behind an
  // arbitrary outline would be visibly wrong. v1 is boxes (and image boxes) only.
  const style = boxStyle(await mount([{ ...BOX, kind: 'path', path: 'M0,0L10,10', bgBlur: 12 }]));
  assert.ok(!style.toLowerCase().includes('backdrop-filter'), `got: ${style}`);
});

test('hostile bgBlur values never produce NaN and clamp to 0..300', async () => {
  for (const [v, expect] of [
    [NaN, null],                              // unparsable → 0 → no declaration
    [1e400, null],                            // Infinity → not finite → 0
    [-40, null],                              // negative → clamped to 0
    ['6"/><script>', 'blur(6px)'],            // parseFloat salvages 6; markup never breaks
    [9999, 'blur(300px)'],                    // clamped to the manifest max
    [12.34, 'blur(12.3px)'],                  // 1-decimal rounding, like `blur`
  ] as Array<[unknown, string | null]>) {
    const style = boxStyle(await mount([{ ...BOX, bgBlur: v }]));
    assert.ok(!style.includes('NaN'), `${String(v)}: no NaN`);
    assert.ok(!style.includes('<') && !style.includes('script'), `${String(v)}: no markup breakout, got: ${style}`);
    if (expect) assert.ok(style.includes('backdrop-filter:' + expect), `${String(v)}: expected ${expect}, got: ${style}`);
    else assert.ok(!style.toLowerCase().includes('backdrop-filter'), `${String(v)}: no declaration, got: ${style}`);
  }
});

// ── engine mapper: Penpot backgroundBlur → node.bgBlur → box.bgBlur ──────────

const SEL = { x: 0, y: 0, width: 100, height: 80 };
const CONTENT = {
  type: 'root', children: [{ type: 'paragraph-set', children: [{
    type: 'paragraph', textAlign: 'left',
    children: [{ text: 'hi', fontSize: '32', fontWeight: '400', fontFamily: 'Work Sans', fills: [{ fillColor: '#123' }] }],
  }] }],
};
const RECT = { id: 'b', type: 'rect', selrect: SEL, fills: [{ fillColor: '#ff0000' }] };

test('the radius mapping constant is pinned (Skia sigma → CSS blur radius)', () => {
  // Penpot's shipping renderer is Skia: sigma = 0.57735 * value + 0.5. CSS
  // backdrop-filter: blur(R) is a Gaussian of sigma R/2, so R = 1.1547 * value + 1.
  // An APPROXIMATION — it matches the sigma, not Penpot's clipping/tiling — pinned
  // here so a future pixel comparison against a real Penpot export moves it on
  // purpose rather than by accident. The real-export INPUT side is now settled:
  // tests/penpot-kitchen-sink.test.ts reads four genuine `backgroundBlur` entries
  // ({id,type,value,hidden}) through this function; only the constant itself still
  // awaits a pixel comparison.
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: 10, hidden: false } }), 12.5);
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: 100 } }), 116.5);
  // Clamped to the field ceiling, and 1-decimal like every other blur field.
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: 9999 } }), 300);
});

test('penpotBackgroundBlurPx: hidden, zero, missing and malformed all read 0', () => {
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: 20, hidden: true } }), 0);
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: 0 } }), 0);
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'background-blur', value: -5 } }), 0);
  // An unknown type on the dedicated key is not silently rendered as a backdrop blur.
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: { type: 'layer-blur', value: 20 } }), 0);
  assert.equal(penpotBackgroundBlurPx({ backgroundBlur: 'nope' }), 0);
  assert.equal(penpotBackgroundBlurPx({}), 0);
  assert.equal(penpotBackgroundBlurPx(null), 0);
  assert.equal(penpotBackgroundBlurPx('nope'), 0);
});

test('penpotShapeToNode: backgroundBlur lands on box and image-fill nodes', () => {
  const bg = { id: 'x', type: 'background-blur', value: 10, hidden: false };

  const box = penpotShapeToNode({ ...RECT, backgroundBlur: bg }) as any;
  assert.equal(box.kind, 'box');
  assert.equal(box.bgBlur, 12.5);
  assert.equal(box.blur, undefined, 'a background blur is never a layer blur');

  const image = penpotShapeToNode({ id: 'i', type: 'rect', selrect: SEL,
    fills: [{ fillImage: { id: 'm1', keepAspectRatio: true } }], backgroundBlur: bg }) as any;
  assert.equal(image.kind, 'image');
  assert.equal(image.bgBlur, 12.5);
});

test('penpotShapeToNode: text and baked vector art drop it (the shell warns)', () => {
  // Penpot masks a text shape's backdrop blur to the GLYPHS (render-wasm DstIn), which
  // a CSS box-level backdrop-filter would not reproduce; a baked path would get a
  // rectangular frost behind an arbitrary outline. Both are out of scope in v1.
  const text = penpotShapeToNode({ id: 't', type: 'text', selrect: SEL, content: CONTENT,
    backgroundBlur: { type: 'background-blur', value: 10 } }) as any;
  assert.equal(text.kind, 'text');
  assert.equal(text.bgBlur, undefined);

  const path = penpotShapeToNode({ id: 'p', type: 'path', selrect: SEL, content: 'M0,0L10,10Z',
    fills: [{ fillColor: '#000000' }], backgroundBlur: { type: 'background-blur', value: 10 } }) as any;
  assert.ok(path._vectorPath, 'vector branch taken');
  assert.equal(path.bgBlur, undefined);
});

test('penpotShapeToNode: the legacy pre-2.17 blur:{type:background-blur} form is background blur', () => {
  // Penpot ships NO migration for it, so files authored before the attribute split
  // still carry it inside `blur`. Reading it as a layer blur would blur the shape's
  // own paint instead of the backdrop — the one outcome that is worse than dropping it.
  const legacy = penpotShapeToNode({ ...RECT, blur: { type: 'background-blur', value: 10 } }) as any;
  assert.equal(legacy.bgBlur, 12.5);
  assert.equal(legacy.blur, undefined);
  // Hidden legacy entries stay off.
  const hidden = penpotShapeToNode({ ...RECT, blur: { type: 'background-blur', value: 10, hidden: true } }) as any;
  assert.equal(hidden.bgBlur, undefined);
});

test('penpotShapeToNode: layer blur and background blur coexist on one shape', () => {
  // render-wasm has an explicit layer_blur_and_background_blur_can_coexist test, and
  // the shape schema carries the two keys side by side — so both fields must be set.
  const node = penpotShapeToNode({
    ...RECT,
    blur: { type: 'layer-blur', value: 4 },
    backgroundBlur: { type: 'background-blur', value: 10 },
  }) as any;
  assert.equal(node.blur, 4);
  assert.equal(node.bgBlur, 12.5);
});

test('penpotShapeToNode: the dedicated attribute wins over a legacy blur entry', () => {
  const node = penpotShapeToNode({
    ...RECT,
    blur: { type: 'background-blur', value: 100 },
    backgroundBlur: { type: 'background-blur', value: 10 },
  }) as any;
  assert.equal(node.bgBlur, 12.5, 'backgroundBlur is authoritative when both are present');
});

test('nodeToBox: bgBlur rounds to 1 decimal, clamps 0..300, defaults 0', () => {
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, bgBlur: 12.34 }, { id: 'a' }).bgBlur, 12.3);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, bgBlur: 9999 }, { id: 'a' }).bgBlur, 300);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, bgBlur: -4 }, { id: 'a' }).bgBlur, 0);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10 }, { id: 'a' }).bgBlur, 0);
});

// ── penpotGroupToSvg: the flatten bails rather than dropping the effect ──────

const groupShapes = (extra?: Record<string, unknown>): Record<string, any> => ({
  g: { id: 'g', type: 'group', selrect: { x: 0, y: 0, width: 200, height: 200 }, shapes: ['art'] },
  art: { id: 'art', type: 'circle', selrect: { x: 20, y: 30, width: 120, height: 100 },
    fills: [{ fillColor: '#14ceca' }], ...(extra ?? {}) },
});

test('penpotGroupToSvg: a visible backgroundBlur leaf refuses the flatten', () => {
  const plain = groupShapes();
  const before = penpotGroupToSvg(plain.g, (id) => plain[id]);
  assert.ok(before, 'premise: the plain group flattens');

  for (const extra of [
    { backgroundBlur: { type: 'background-blur', value: 9 } },
    { blur: { type: 'background-blur', value: 9 } },   // legacy spelling
  ]) {
    const shapes = groupShapes(extra);
    assert.equal(penpotGroupToSvg(shapes.g, (id) => shapes[id]), '', JSON.stringify(extra));
  }

  // Hidden or zero-valued entries are not an effect at all — the flatten stays
  // byte-identical, so nothing that used to bake starts falling back.
  for (const extra of [
    { backgroundBlur: { type: 'background-blur', value: 9, hidden: true } },
    { backgroundBlur: { type: 'background-blur', value: 0 } },
  ]) {
    const shapes = groupShapes(extra);
    assert.equal(penpotGroupToSvg(shapes.g, (id) => shapes[id]), before, JSON.stringify(extra));
  }
});
