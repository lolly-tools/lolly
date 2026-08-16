// SPDX-License-Identifier: MPL-2.0
/**
 * Design - box `blur` (layer blur) contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Modeled on design-gradient.test.ts: drives the REAL tool (manifest +
 * hooks) through the engine, so these guard the actual render rather than a
 * paraphrase of it. Renders load from brands/lolly-start (parent-owned, present
 * in every checkout); the manifest assertions run over BOTH brand forks, since
 * the SAME edit ships in both packs and the wire slot has to match.
 *
 * Three surfaces are covered:
 *   1. The manifest: `blur` is APPENDED (wire slot 53) - compact block URLs
 *      encode fields positionally, so the slot is a permanent contract.
 *   2. The hooks: `blur` emits `filter:blur(Npx)` merged with a content
 *      drop-shadow into ONE filter declaration (blur first), and a box without
 *      blur renders byte-identically to before the field existed.
 *   3. The engine mapper: Penpot `{type:'layer-blur', value:N}` → node.blur →
 *      box.blur (1-decimal, clamped), and penpotGroupToSvg bakes a real
 *      feGaussianBlur def (userSpaceOnUse, 3σ+8 region) into flattened groups.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { nodeToBox, penpotShapeToNode, penpotGroupToSvg } from '../engine/src/design-map.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Both brand variants ship the tool; suse is a private submodule public clones skip. */
const BRANDS = (['lolly-start', 'suse'] as const).filter((b) =>
  existsSync(join(ROOT, 'brands', b, 'tools', 'design', 'tool.json')));

const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'brands/lolly-start/tools/design/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

/** Mount the real lolly-start tool and return the hydrated markup. */
async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

const BOX = {
  id: 'b1', kind: 'box', x: 0, y: 0, w: 400, h: 300, shape: 'rect', bg: '#eeeeee', opacity: 100,
};
// The style attribute of the first .lolly-box in the hydrated markup.
const boxStyle = (html: string): string =>
  /<div class="lolly-box[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';

// ── manifest shape ───────────────────────────────────────────────────────────

test('a `blur` number field exists in every mounted brand fork and holds wire slot 53', () => {
  for (const brand of BRANDS) {
    const manifest = JSON.parse(readFileSync(
      join(ROOT, 'brands', brand, 'tools', 'design', 'tool.json'), 'utf8'));
    const fields = manifest.inputs.find((i: any) => i.id === 'boxes').fields as any[];
    const blur = fields.find((f) => f.id === 'blur');
    assert.ok(blur, `${brand}: boxes has a \`blur\` sub-field`);
    assert.equal(blur.type, 'number', `${brand}: blur type`);
    assert.equal(blur.default, 0, `${brand}: blur default`);
    assert.equal(blur.min, 0, `${brand}: blur min`);
    assert.equal(blur.max, 300, `${brand}: blur max`);
    // Compact block URLs encode fields POSITIONALLY, so a new field can only be
    // APPENDED - `blur` landed as the 54th field (index 53, right after `grad`)
    // and must stay there forever.
    assert.equal(fields.indexOf(blur), 53, `${brand}: blur moved slot (wire order is locked)`);
  }
});

// ── rendering through the real hooks ─────────────────────────────────────────

test('blur absent and blur:0 render byte-identically, with no filter declaration', async () => {
  const bare = boxStyle(await mount([{ ...BOX }]));
  const zero = boxStyle(await mount([{ ...BOX, blur: 0 }]));
  assert.equal(zero, bare, 'blur:0 is byte-identical to the field being absent');
  assert.ok(!bare.includes('filter:'), `a shadowless box carries no filter: ${bare}`);
});

test('blur:2 emits filter:blur(2px)', async () => {
  const style = boxStyle(await mount([{ ...BOX, blur: 2 }]));
  assert.ok(style.includes('filter:blur(2px);'), `got: ${style}`);
});

test('blur + content shadow merge into ONE filter declaration, blur first', async () => {
  const style = boxStyle(await mount([{ ...BOX, blur: 2, shadow: 'content' }]));
  assert.equal((style.match(/filter:/g) ?? []).length, 1, `exactly one filter declaration: ${style}`);
  const b = style.indexOf('blur(2px)');
  const d = style.indexOf('drop-shadow(');
  assert.ok(b >= 0 && d >= 0, `both functions present: ${style}`);
  assert.ok(b < d, 'blur comes first so the drop-shadow follows the blurred silhouette');
});

test('a content shadow WITHOUT blur is byte-identical to the pre-blur output', async () => {
  // The filterFn refactor must reassemble exactly `filter:drop-shadow(...);` - 
  // this is the same guarantee the extras baseline fixture locks byte-for-byte.
  const style = boxStyle(await mount([{ ...BOX, shadow: 'content' }]));
  assert.match(style, /filter:drop-shadow\([^)]*\);/, `got: ${style}`);
  assert.ok(!style.includes('blur('), 'no blur function without the field');
});

test('hostile blur values never produce NaN and clamp to 0..300', async () => {
  for (const [v, expect] of [
    [NaN, null],                 // unparsable → 0 → no filter
    [1e400, null],               // Infinity → not finite → 0
    [-40, null],                 // negative → clamped to 0
    ['4"/><script>', 'blur(4px)'], // parseFloat salvages 4; markup never breaks
    [9999, 'blur(300px)'],       // clamped to the manifest max
  ] as Array<[unknown, string | null]>) {
    const style = boxStyle(await mount([{ ...BOX, blur: v }]));
    assert.ok(!style.includes('NaN'), `${String(v)}: no NaN`);
    // The value lands in an escaped style ATTRIBUTE - nothing tag-shaped survives
    // there. (The whole document legitimately contains the template's own <script>.)
    assert.ok(!style.includes('<') && !style.includes('script'), `${String(v)}: no markup breakout, got: ${style}`);
    if (expect) assert.ok(style.includes(expect), `${String(v)}: expected ${expect}, got: ${style}`);
    else assert.ok(!style.includes('filter:'), `${String(v)}: no filter, got: ${style}`);
  }
});

// ── engine mapper: Penpot layer-blur → node.blur → box.blur ──────────────────

const SEL = { x: 0, y: 0, width: 100, height: 80 };
const CONTENT = {
  type: 'root', children: [{ type: 'paragraph-set', children: [{
    type: 'paragraph', textAlign: 'left',
    children: [{ text: 'hi', fontSize: '32', fontWeight: '400', fontFamily: 'Work Sans', fills: [{ fillColor: '#123' }] }],
  }] }],
};
const LAYER_BLUR = { type: 'layer-blur', value: 2, hidden: false };

test('penpotShapeToNode: layer-blur lands on all four node kinds', () => {
  const text = penpotShapeToNode({ id: 't', type: 'text', selrect: SEL, content: CONTENT, blur: LAYER_BLUR }) as any;
  assert.equal(text.kind, 'text');
  assert.equal(text.blur, 2);

  const image = penpotShapeToNode({ id: 'i', type: 'rect', selrect: SEL,
    fills: [{ fillImage: { id: 'm1', keepAspectRatio: true } }], blur: LAYER_BLUR }) as any;
  assert.equal(image.kind, 'image');
  assert.equal(image.blur, 2);

  const path = penpotShapeToNode({ id: 'p', type: 'path', selrect: SEL,
    content: 'M0,0L10,10Z', fills: [{ fillColor: '#000000' }], blur: LAYER_BLUR }) as any;
  assert.ok(path._vectorPath, 'vector branch taken');
  assert.equal(path.blur, 2, 'blur rides the image BOX, not the baked path SVG');

  const box = penpotShapeToNode({ id: 'b', type: 'rect', selrect: SEL,
    fills: [{ fillColor: '#ff0000' }], blur: { type: 'layer-blur', value: 40.6 } }) as any;
  assert.equal(box.kind, 'box');
  assert.equal(box.blur, 40.6);
});

test('penpotShapeToNode: hidden and background-blur entries are ignored', () => {
  const base = { id: 'b', type: 'rect', selrect: SEL, fills: [{ fillColor: '#fff' }] };
  const hid = penpotShapeToNode({ ...base, blur: { type: 'layer-blur', value: 5, hidden: true } }) as any;
  assert.equal(hid.blur, undefined, 'hidden blur never maps');
  // Background blur is its OWN field (bgBlur → CSS backdrop-filter); it must never
  // leak into `blur`, which blurs the box's own paint rather than what is behind it.
  // The legacy pre-2.17 in-`blur` spelling is covered here; the modern `backgroundBlur`
  // attribute and the radius mapping live in design-bgblur.test.ts.
  const bg = penpotShapeToNode({ ...base, blur: { type: 'background-blur', value: 5 } }) as any;
  assert.equal(bg.blur, undefined, 'background-blur is never a layer blur');
  assert.ok(bg.bgBlur > 0, 'background-blur lands on bgBlur instead');
  const zero = penpotShapeToNode({ ...base, blur: { type: 'layer-blur', value: 0 } }) as any;
  assert.equal(zero.blur, undefined, 'value 0 = off');
  const junk = penpotShapeToNode({ ...base, blur: 'nope' }) as any;
  assert.equal(junk.blur, undefined, 'non-object blur ignored');
});

test('nodeToBox: blur rounds to 1 decimal, clamps 0..300, defaults 0', () => {
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, blur: 193.74 }, { id: 'a' }).blur, 193.7);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, blur: 40.64 }, { id: 'a' }).blur, 40.6);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, blur: 9999 }, { id: 'a' }).blur, 300);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10, blur: -4 }, { id: 'a' }).blur, 0);
  assert.equal(nodeToBox({ kind: 'box', w: 10, h: 10 }, { id: 'a' }).blur, 0);
});

// ── penpotGroupToSvg: the baked feGaussianBlur def ───────────────────────────

const groupShapes = (artBlur?: unknown): Record<string, any> => ({
  g: { id: 'g', type: 'group', selrect: { x: 0, y: 0, width: 200, height: 200 }, shapes: ['art'] },
  art: { id: 'art', type: 'circle', selrect: { x: 20, y: 30, width: 120, height: 100 },
    fills: [{ fillColor: '#14ceca' }], ...(artBlur !== undefined ? { blur: artBlur } : {}) },
});

test('penpotGroupToSvg: a blurred circle leaf bakes a userSpaceOnUse feGaussianBlur def', () => {
  const shapes = groupShapes({ type: 'layer-blur', value: 40.6 });
  const svg = penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  assert.ok(svg, 'the flatten still succeeds (no bail on blur)');
  // stdDeviation = Penpot value, 1:1; region = selrect padded by 3σ+8, page-space.
  const pad = 40.6 * 3 + 8;
  assert.ok(svg.includes(
    `<filter id="pb0" filterUnits="userSpaceOnUse" x="${20 - pad}" y="${30 - pad}" width="${120 + 2 * pad}" height="${100 + 2 * pad}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="40.6"/></filter>`),
    `blur def present with the 3σ+8 region: ${svg}`);
  assert.match(svg, /<ellipse [^>]*filter="url\(#pb0\)"\/>/, 'the leaf references the def');
});

test('penpotGroupToSvg: blur inside a maskedGroup keeps the clipPath (blur then clip)', () => {
  const shapes: Record<string, any> = {
    g: { id: 'g', type: 'group', maskedGroup: true, selrect: { x: 0, y: 0, width: 100, height: 100 }, shapes: ['mask', 'art'] },
    mask: { id: 'mask', type: 'path', selrect: { x: 0, y: 0, width: 100, height: 100 }, content: 'M0,0L100,0L100,100Z', fills: [{ fillColor: '#b1b2b5' }] },
    art: { id: 'art', type: 'circle', selrect: { x: 10, y: 10, width: 80, height: 80 },
      fills: [{ fillColor: '#14ceca' }], blur: { type: 'layer-blur', value: 155 } },
  };
  const svg = penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  assert.ok(svg.includes('feGaussianBlur'), `blur def baked: ${svg}`);
  assert.match(svg, /<g clip-path="url\(#pc\d+\)">/, 'the mask clip is retained');
  assert.match(svg, /<ellipse [^>]*filter="url\(#pb\d+\)"\/>/, 'the blurred leaf sits inside the clip group');
});

test('penpotGroupToSvg: blur 0 / hidden emit byte-identical output to no blur at all', () => {
  const plain = groupShapes();
  const before = penpotGroupToSvg(plain.g, (id) => plain[id]);
  for (const b of [{ type: 'layer-blur', value: 0 }, { type: 'layer-blur', value: 9, hidden: true },
    { type: 'background-blur', value: 9, hidden: true }]) {
    const shapes = groupShapes(b);
    assert.equal(penpotGroupToSvg(shapes.g, (id) => shapes[id]), before, JSON.stringify(b));
  }
  // A VISIBLE background blur is different in kind: it reads what is painted behind
  // the group, which a standalone flattened SVG cannot see. The flatten bails so the
  // subtree falls to the per-shape import, where bgBlur still reaches a box.
  const bailed = groupShapes({ type: 'background-blur', value: 9 });
  assert.equal(penpotGroupToSvg(bailed.g, (id) => bailed[id]), '',
    'a visible background-blur leaf refuses the flatten rather than dropping the effect');
});
