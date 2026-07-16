/**
 * deck-builder freeform-mode contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — node:test built-in.
 *
 * Loads the REAL community tool from disk and drives it through the engine with a
 * stub host, so these guard the tool's actual render. Two contradictory slide modes
 * share one deck:
 *   - mode:"layout" (or absent)  → the structured templates (head/body/slot grid).
 *   - mode:"freeform"            → a free canvas of absolutely-positioned boxes,
 *     each placed as a % of the slide (px on the 1920² native canvas ÷ native W/H).
 *
 * The freeform path must NOT disturb layout slides, the theme/logo/page-number
 * chrome, or the animation/export machinery ([data-slide-clock], [data-pdf-page],
 * the trailing <style>, speaker notes).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

// deck-builder is a community tool → present under every profile. Skip only if the
// views aren't built at all.
const SKIP = !existsSync(join(TOOLS_DIR, 'deck-builder/tool.json'))
  && 'deck-builder tool view not built (run npm run profile)';

const tool: any = SKIP ? null : await loadTool('deck-builder', fetchFile);

function makeHost() {
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    // No token/logo capabilities → the hook uses its static fallbacks.
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) },
    log: () => {},
  };
  return host;
}

async function mount(deck: unknown) {
  const rt = await createRuntime(tool, makeHost(), { deck: deck as never });
  return { rt, html: rt.getHydrated() as string };
}

const FREEFORM_BOXES = [
  { kind: 'text', x: 100, y: 100, w: 800, h: 200, text: '# Hi', color: '#ff0000', fontSize: 96, align: 'c' },
  { kind: 'image', x: 100, y: 400, w: 600, h: 400, src: 'https://x/a.png' },
  { kind: 'text', x: 1000, y: 100, w: 700, h: 300, rot: 12, text: '## Rotated\n\n- one\n- two' },
  { kind: 'image', x: 1000, y: 600, w: 500, h: 300, src: 'javascript:alert(1)' }, // must be dropped
];

const MIXED_DECK = [
  { layout: 'title', mode: 'layout', content: '# Layout slide\n\n- keeps working', theme: 'auto', notes: 'a note' },
  { mode: 'freeform', theme: 'dark', boxes: FREEFORM_BOXES },
];

test('deck-builder loads with the new mode + boxes sub-fields', { skip: SKIP }, () => {
  const fields = (tool.manifest.inputs.find((i: any) => i.id === 'deck').fields as any[]);
  const mode = fields.find(f => f.id === 'mode');
  const boxes = fields.find(f => f.id === 'boxes');
  assert.ok(mode, 'deck has a `mode` sub-field');
  assert.equal(mode.type, 'select');
  assert.equal(mode.default, 'layout');
  assert.deepEqual(mode.options.map((o: any) => o.value), ['layout', 'freeform']);
  assert.ok(boxes, 'deck has a `boxes` sub-field');
});

test('animation OFF by default: an unset transition rests STILL (sl-frozen on slide 0), never auto-plays', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: '# One' }, { content: '# Two' }, { content: '# Three' }]);
  assert.match(html, /class="slides sl-frozen"/, 'resting deck is static (sl-frozen)');
  assert.doesNotMatch(html, /class="slides sl-anim"/, 'does NOT auto-play (no sl-anim)');
  assert.match(html, /sl-frozen \.sl-slide--0\s*\{\s*opacity:1/, 'slide 0 is held visible under the freeze');
});

test('animation is opt-in: choosing a transition (and no focus) lets an unfocused deck play', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, makeHost(), { deck: [{ content: '# One' }, { content: '# Two' }], transition: 'fade', focusSlide: 0 });
  const html = rt.getHydrated() as string;
  assert.match(html, /class="slides sl-anim"/, 'an explicit transition + no focus plays (sl-anim)');
});

test('a mixed deck: layout slide unchanged, freeform slide renders boxes', { skip: SKIP }, async () => {
  const { rt, html } = await mount(MIXED_DECK);
  assert.deepEqual(rt.hookErrors, [], 'no hook errors');

  // two stacked slides, both paged + notes preserved
  assert.equal((html.match(/class="sl-slide /g) ?? []).length, 2);
  assert.equal((html.match(/data-pdf-page/g) ?? []).length, 2);
  assert.match(html, /data-slide-clock/);           // export frame clock
  assert.match(html, /<style>/);                    // per-slide keyframes
  assert.match(html, /data-slide-notes hidden/);    // speaker notes

  // layout slide (idx 0): structured render, NO canvas
  const s0 = html.split('sl-slide--1')[0]!;
  assert.match(s0, /class="sl-title">Layout slide</);
  assert.match(s0, /class="sl-body"/);
  assert.doesNotMatch(s0, /sl-canvas/);

  // freeform slide (idx 1): a canvas of boxes, NO head/body/slot-grid
  const s1 = 'sl-slide--1' + html.split('sl-slide--1').slice(1).join('sl-slide--1');
  assert.match(s1, /class="sl-canvas"/);
  assert.doesNotMatch(s1, /class="sl-title"/);
  assert.doesNotMatch(s1, /class="sl-grid"/);
});

test('freeform box geometry: px on the 1920 canvas → % of the slide', { skip: SKIP }, async () => {
  const { html } = await mount(MIXED_DECK);
  // 100/1920 = 5.2083%, 800/1920 = 41.6667%, 200/1920 = 10.4167%
  assert.match(html, /left: 5\.2083%; top: 5\.2083%; width: 41\.6667%; height: 10\.4167%;/);
  // rotation about the box centre
  assert.match(html, /transform: rotate\(12deg\);/);
  // four boxes rendered
  assert.equal((html.match(/class="sl-box /g) ?? []).length, 4);
});

test('freeform text box: same markdown renderer + inline styling', { skip: SKIP }, async () => {
  const { html } = await mount(MIXED_DECK);
  // '# Hi' → an <h1> inside the box (mdBox), colour + font-size (96/1920 = 5cqw) + align inline
  assert.match(html, /class="sl-box-text" style="text-align: center; color: #ff0000; font-size: 5cqw;">\s*<h1>Hi<\/h1>/);
  // second text box: subhead + bullet list
  assert.match(html, /<h2>Rotated<\/h2><ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test('freeform image box: safe src only (javascript: dropped)', { skip: SKIP }, async () => {
  const { html } = await mount(MIXED_DECK);
  assert.match(html, /<img class="sl-box-img" src="https:\/\/x\/a\.png"/);
  assert.doesNotMatch(html, /javascript:alert/);   // dangerous scheme never reaches an <img>
});

test('freeform slide still gets theme chrome (bg/ink + page number)', { skip: SKIP }, async () => {
  const { html } = await mount(MIXED_DECK);
  const s1 = 'sl-slide--1' + html.split('sl-slide--1').slice(1).join('sl-slide--1');
  assert.match(s1, /--bg:[^;]+; --ink:[^;]+; --accent:/);  // theme colours inlined
  assert.match(s1, /class="sl-pageno"/);                   // page number chrome
});

test('boxes as a JSON string renders identically to an array', { skip: SKIP }, async () => {
  const arr = await mount(MIXED_DECK);
  const jsonForm = await mount([
    MIXED_DECK[0],
    { mode: 'freeform', theme: 'dark', boxes: JSON.stringify(FREEFORM_BOXES) },
  ]);
  assert.deepEqual(jsonForm.rt.hookErrors, []);
  assert.equal(jsonForm.html, arr.html, 'JSON-string boxes match array boxes byte-for-byte');
});

test('malformed boxes render an empty canvas, never throw', { skip: SKIP }, async () => {
  const { rt, html } = await mount([{ mode: 'freeform', boxes: 'not json {' }]);
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /class="sl-canvas"/);
  assert.equal((html.match(/class="sl-box /g) ?? []).length, 0);
});

// ── shape boxes (kind:"box") — plain filled shapes for pptxgenjs-style cards ─────

// One rounded, filled, bordered card. radius/lineWidth are NATIVE px → slide-relative
// cqw so they scale with the frame (like box.fontSize), never fixed px.
const SHAPE_SLIDE = {
  mode: 'freeform',
  boxes: [{ kind: 'box', x: 100, y: 100, w: 800, h: 400, fill: '#30BA78', shape: 'round', radius: 24, lineColor: '#0c322c', lineWidth: 4 }],
};

test('shape box: filled rounded card → .sl-box-shape with fill + cqw radius + cqw border', { skip: SKIP }, async () => {
  const { rt, html } = await mount([SHAPE_SLIDE]);
  assert.deepEqual(rt.hookErrors, [], 'no hook errors');

  // The shape is a single styled div inside the .sl-box wrapper (which owns geometry).
  assert.match(html, /class="sl-box sl-box--box"/, 'wrapper carries the box kind class');
  // Solid fill from safeColor (case preserved).
  assert.match(html, /<div class="sl-box-shape" style="background:#30BA78/, 'solid fill applied');
  // Corner radius is SLIDE-RELATIVE (cqw), not fixed px: 24/1920*100 = 1.25cqw.
  assert.match(html, /border-radius:calc\(1\.25cqw\)/, 'round radius is calc(cqw), scales with the slide');
  // Border is slide-relative too: 4/1920*100 = 0.2083cqw.
  assert.match(html, /border: 0\.2083cqw solid #0c322c/, 'border width is cqw, colour sanitised');
  // A shape box carries NO text/img child of its own.
  const shape = 'sl-box-shape' + html.split('sl-box-shape').slice(1).join('sl-box-shape');
  assert.doesNotMatch(shape.split('</div>')[0] + '</div>', /sl-box-text|sl-box-img/);
});

test('shape box: geometry reuses the same px→% mapping as text/image boxes', { skip: SKIP }, async () => {
  const { html } = await mount([SHAPE_SLIDE]);
  // 100/1920 = 5.2083%, 800/1920 = 41.6667%, 400/1920 = 20.8333%
  assert.match(html, /left: 5\.2083%; top: 5\.2083%; width: 41\.6667%; height: 20\.8333%;/);
});

test('shape variants: pill → 9999px, ellipse → 50%, rect/absent → 0', { skip: SKIP }, async () => {
  const { html } = await mount([{
    mode: 'freeform',
    boxes: [
      { kind: 'box', x: 0, y: 0, w: 400, h: 200, fill: '#111111', shape: 'pill' },
      { kind: 'box', x: 0, y: 300, w: 300, h: 300, fill: '#222222', shape: 'ellipse' },
      { kind: 'box', x: 0, y: 700, w: 500, h: 200, fill: '#333333' },   // shape absent → rect
    ],
  }]);
  assert.match(html, /background:#111111; border-radius:9999px/, 'pill → 9999px');
  assert.match(html, /background:#222222; border-radius:50%/, 'ellipse → 50%');
  assert.match(html, /background:#333333; border-radius:0;/, 'rect/absent → 0');
});

test('shape box: transparent (no fill) + no border emits a bare shape div, never raw input', { skip: SKIP }, async () => {
  const { rt, html } = await mount([{ mode: 'freeform', boxes: [{ kind: 'box', x: 0, y: 0, w: 100, h: 100, fill: 'not a color</style>' }] }]);
  assert.deepEqual(rt.hookErrors, []);
  // Bogus fill is rejected by safeColor → no background declared, no injection.
  assert.match(html, /<div class="sl-box-shape" style=" border-radius:0;"><\/div>/);
  assert.doesNotMatch(html, /not a color/, 'the rejected raw fill never reaches the output');
});

test('a text box and a shape box on one slide both render and layer in ARRAY order', { skip: SKIP }, async () => {
  const { rt, html } = await mount([{
    mode: 'freeform',
    boxes: [
      { kind: 'box', x: 0, y: 0, w: 1920, h: 1920, fill: '#0c322c', shape: 'round', radius: 40 },  // background card
      { kind: 'text', x: 120, y: 120, w: 800, h: 300, text: '# On top', color: '#ffffff' },        // text over it
    ],
  }]);
  assert.deepEqual(rt.hookErrors, []);
  const iShape = html.indexOf('sl-box-shape');
  const iText = html.indexOf('sl-box-text');
  assert.ok(iShape >= 0, 'shape box renders');
  assert.ok(iText >= 0, 'text box renders');
  // Array order is z-order (later boxes stack above earlier ones): the shape is first
  // in the array so it appears FIRST in the DOM, under the text.
  assert.ok(iShape < iText, 'shape (array[0]) precedes text (array[1]) in DOM = z-order');
  // The text box still renders its markdown through the shared renderer, untouched.
  assert.match(html, /class="sl-box-text"[^>]*>\s*<h1>On top<\/h1>/);
});

// ── starter deck + accent→mono logo (later refinements) ───────────────────────

test('default deck ships a single starter slide', { skip: SKIP }, () => {
  const d = (tool.manifest.inputs.find((i: any) => i.id === 'deck').default as any[]);
  assert.equal(Array.isArray(d) ? d.length : -1, 1, 'one welcoming starter slide');
});

// A host with brand logo assets on BOTH sides (on-light/on-dark) × colour/mono, so the
// scheme→variant pick is observable. URLs encode side+variant.
function logoHost() {
  const assets: any[] = [];
  for (const side of ['on-light', 'on-dark']) for (const v of ['color', 'mono']) {
    const tags = ['logo', side, 'horizontal']; if (v === 'mono') tags.push('mono');
    assets.push({ id: side + '-' + v, url: side.toUpperCase() + '-' + v.toUpperCase() + '.svg', width: 340, height: 100, tags });
  }
  return {
    version: '1', profile: { get: async () => ({}) },
    assets: {
      get: async (id: string) => assets.find(a => a.id === id) ?? { id, url: id + '.svg', width: 340, height: 100 },
      query: async (o: any) => assets.filter(a => (o.tags || []).every((t: string) => a.tags.includes(t))),
    },
    log: () => {},
  } as any;
}
const renderLogo = async (slide: any) =>
  (await createRuntime(tool, logoHost(), { deck: [slide], brandLogo: true, pageNumbers: true })).getHydrated() as string;

test('accent scheme forces the MONO logo (accent bg ≈ the brand logomark colour)', { skip: SKIP }, async () => {
  const html = await renderLogo({ content: '# A', theme: 'accent' });
  assert.match(html, /-MONO\.svg/, 'accent uses a mono logo');
  assert.doesNotMatch(html, /-COLOR\.svg/, 'accent does NOT use a colour logo');
});

test('non-accent schemes keep the COLOUR logo (light + dark sides)', { skip: SKIP }, async () => {
  assert.match(await renderLogo({ content: '# A', theme: 'light' }), /ON-LIGHT-COLOR\.svg/);
  assert.match(await renderLogo({ content: '# A', theme: 'dark' }), /ON-DARK-COLOR\.svg/);
});
