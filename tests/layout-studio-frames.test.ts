// SPDX-License-Identifier: MPL-2.0
/**
 * Layout Studio — hand-authored frames render as per-frame [data-pdf-page] (plan 93 F1a-part-2).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * Loads the REAL tool from disk and drives it through the engine with a stub host, so
 * these guard the tool's actual render. Layout Studio ships in two packs — the private
 * brands/suse one and the parent-owned brands/lolly-start one — with byte-identical
 * hooks.js/template.html (only tool.json + brand fonts differ). We load from
 * brands/lolly-start (always present in a public checkout; brands/suse is a private
 * submodule CI skips), so the suite never silently skips.
 *
 * The contract:
 *   - NO-FRAMES BYTE-IDENTITY (the centerpiece): with only non-frame boxes the output is
 *     exactly today's single .artboard, {{#each boxes}}, global coords — ZERO [data-pdf-page].
 *   - FRAMES-PRESENT: each kind:"frame" box becomes one [data-pdf-page] sized to the frame's
 *     w×h; members (box.frame === frame.id) render at frame-LOCAL coords; page order is
 *     ascending `order`, tie-break ascending x.
 *   - PASTEBOARD (F1b-2): a non-frame box with frame==="" (or a frame id matching no page)
 *     renders LOOSE at global coords under the frames wrapper, OUTSIDE every [data-pdf-page]
 *     — visible in the editor, excluded from the per-page export by construction.
 *   - clipChildren:false makes that page overflow:visible (not hidden).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
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

async function mount(boxes: unknown[]) {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

const count = (s: string, needle: RegExp) => (s.match(needle) ?? []).length;

// ── NO-FRAMES BYTE-IDENTITY ───────────────────────────────────────────────────────

test('no frame boxes → exactly one .artboard, ZERO [data-pdf-page], children at GLOBAL coords', async () => {
  const html = await mount([
    { id: 'a', kind: 'box', x: 120, y: 80, w: 300, h: 200, shape: 'rect', bg: '#30BA78' },
    { id: 'b', kind: 'text', x: 500, y: 400, w: 400, h: 200, text: 'Hi', fontSize: 48 },
  ]);
  // No paged output at all — the sacred invariant.
  assert.ok(!html.includes('data-pdf-page'), 'no [data-pdf-page] in the no-frames render');
  assert.ok(!html.includes('lolly-frames'), 'the frames wrapper is absent');
  // Exactly one artboard root, and it opens the render (the {{else}} branch, verbatim).
  assert.equal(count(html, /class="artboard"/g), 1, 'exactly one .artboard');
  // Children keep their GLOBAL left/top (no frame offset applied).
  assert.match(html, /data-box-id="a"[^>]*style="[^"]*left:120px;top:80px/, 'box a at global (120,80)');
  assert.match(html, /data-box-id="b"[^>]*style="[^"]*left:500px;top:400px/, 'box b at global (500,400)');
});

// ── FRAMES-PRESENT ────────────────────────────────────────────────────────────────

test('two frame boxes → exactly two [data-pdf-page], each sized to its frame w×h', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff' },
    { id: 'fb', kind: 'frame', x: 1000, y: 0, w: 400, h: 400, order: 0, bg: '#000000' },
    { id: 'ca', kind: 'box', x: 50, y: 60, w: 100, h: 100, shape: 'rect', bg: '#30BA78', frame: 'fa' },
    { id: 'cb', kind: 'text', x: 1050, y: 30, w: 200, h: 80, text: 'B', fontSize: 40, frame: 'fb' },
  ]);
  assert.ok(!html.includes('class="artboard"'), 'the single-artboard branch is NOT taken');
  assert.equal(count(html, /data-pdf-page/g), 2, 'exactly two paged frames');
  // Pages are free-placed: absolutely positioned at the frame's authored (x,y) so the
  // overlay reads offsetLeft/offsetTop back as the frame origin (F1b frame-local drag).
  assert.match(html, /data-pdf-page style="position:absolute;left:0px;top:0px;width:800px;height:600px/, 'frame fa page is 800×600 at (0,0)');
  assert.match(html, /data-pdf-page style="position:absolute;left:1000px;top:0px;width:400px;height:400px/, 'frame fb page is 400×400 at (1000,0)');
  // The frame-kind boxes are pages, never also rendered as child boxes.
  assert.ok(!html.includes('data-box-id="fa"'), 'frame fa is not also a child box');
  assert.ok(!html.includes('data-box-id="fb"'), 'frame fb is not also a child box');
});

test('page ORDER follows `order` asc (then x) — fb(order 0) before fa(order 1)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff' },
    { id: 'fb', kind: 'frame', x: 1000, y: 0, w: 400, h: 400, order: 0, bg: '#000000' },
  ]);
  const iFb = html.indexOf('width:400px;height:400px'); // fb
  const iFa = html.indexOf('width:800px;height:600px'); // fa
  assert.ok(iFb >= 0 && iFa >= 0, 'both pages present');
  assert.ok(iFb < iFa, 'fb (order 0) renders before fa (order 1)');
});

test('ties on `order` break by ascending x (left→right)', async () => {
  const html = await mount([
    { id: 'right', kind: 'frame', x: 900, y: 0, w: 300, h: 300, order: 0, bg: '#111111' },
    { id: 'left', kind: 'frame', x: 100, y: 0, w: 500, h: 500, order: 0, bg: '#222222' },
  ]);
  const iLeft = html.indexOf('width:500px;height:500px'); // left frame (x=100)
  const iRight = html.indexOf('width:300px;height:300px'); // right frame (x=900)
  assert.ok(iLeft >= 0 && iRight >= 0, 'both pages present');
  assert.ok(iLeft < iRight, 'lower x renders first on an order tie');
});

test('a member box renders at frame-LOCAL coords (left = box.x - frame.x)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 200, y: 100, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'ca', kind: 'box', x: 250, y: 160, w: 100, h: 100, shape: 'rect', bg: '#30BA78', frame: 'fa' },
  ]);
  // The page itself is absolutely placed at the frame's authored origin (200,100).
  assert.match(html, /data-pdf-page style="position:absolute;left:200px;top:100px;width:800px;height:600px/, 'page sits at its authored (200,100)');
  // 250-200 = 50, 160-100 = 60. The reused boxStyle still carries the global left/top from
  // boxCss; the frame-local override is APPENDED last, so it is the winning declaration and
  // sits at the very end of the style attribute (later same-property declaration wins).
  assert.match(html, /data-box-id="ca"[^>]*style="[^"]*left:50px;top:60px;"/, 'member ends with the winning frame-local left/top');
});

// ── PASTEBOARD (F1b-2) ────────────────────────────────────────────────────────────────
//
// Scratch boxes are no longer dropped: they render LOOSE at their GLOBAL coordinates
// directly under the frames wrapper, OUTSIDE every [data-pdf-page]. The editor shows them,
// but the per-page export path (renderMultiPagePdf/exportPaged walk [data-pdf-page] nodes
// ONLY) excludes them by construction. We parse the render with jsdom so "outside every
// page" and "child of the canvas root" are asserted structurally, not by string order.

test('a scratch box (frame==="") renders LOOSE — child of the canvas root, NOT any page', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'member', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#30BA78', frame: 'fa' },
    { id: 'scratch', kind: 'box', x: 20, y: 20, w: 100, h: 100, shape: 'rect', bg: '#123456', frame: '' },
  ]);
  const doc = new JSDOM(html).window.document;
  const member = doc.querySelector('[data-box-id="member"]');
  const scratch = doc.querySelector('[data-box-id="scratch"]');
  assert.ok(member, 'the frame member renders');
  assert.ok(scratch, 'the scratch box IS rendered (loose on the pasteboard, no longer dropped)');
  // The member lives inside its page; the scratch box lives inside NO page.
  assert.ok(member!.closest('[data-pdf-page]'), 'the member is inside its [data-pdf-page]');
  assert.equal(scratch!.closest('[data-pdf-page]'), null,
    'the scratch box is OUTSIDE every [data-pdf-page] — excluded from per-page export by construction');
  // It is a DIRECT child of the frames/canvas root, not nested in a page.
  const frames = doc.querySelector('.lolly-frames');
  assert.ok(frames, 'the frames wrapper exists');
  assert.equal(scratch!.parentElement, frames, 'the scratch box is a direct child of the canvas root');
  // ...at its GLOBAL coordinates (no frame-local offset applied, unlike a page child).
  assert.match(scratch!.getAttribute('style') ?? '', /left:20px;top:20px/, 'scratch box at its global (20,20)');
});

test('NO [data-pdf-page] subtree contains the scratch box (the export walk skips it)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'scratch', kind: 'box', x: 20, y: 20, w: 100, h: 100, shape: 'rect', bg: '#123456', frame: '' },
  ]);
  const doc = new JSDOM(html).window.document;
  for (const page of doc.querySelectorAll('[data-pdf-page]')) {
    assert.equal(page.querySelector('[data-box-id="scratch"]'), null, 'no page subtree contains the scratch box');
  }
  assert.ok(doc.querySelector('[data-box-id="scratch"]'), 'yet it is present in the render (loose)');
});

test('an orphan box (frame id matches no page) also renders LOOSE, not on any page', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'orphan', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#30BA78', frame: 'ghost' },
  ]);
  const doc = new JSDOM(html).window.document;
  const orphan = doc.querySelector('[data-box-id="orphan"]');
  assert.ok(orphan, 'orphan box is rendered (loose on the pasteboard)');
  assert.equal(orphan!.closest('[data-pdf-page]'), null,
    'a box whose frame id matches no frame is NOT placed on any page');
});

// ── clipChildren ─────────────────────────────────────────────────────────────────────

test('clipChildren:true (default) → the page clips (overflow:hidden)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', clipChildren: true },
  ]);
  assert.match(html, /data-pdf-page style="position:absolute;left:0px;top:0px;width:800px;height:600px;background:#ffffff;overflow:hidden;/, 'clips by default');
});

test('clipChildren:false → that page is overflow:visible, NOT hidden', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', clipChildren: false },
  ]);
  assert.match(html, /width:800px;height:600px;background:#ffffff;overflow:visible;/, 'unclipped page is overflow:visible');
  assert.ok(!/width:800px;height:600px;background:#ffffff;overflow:hidden/.test(html), 'not overflow:hidden');
});

// ── frames AS scenes: sequenced frame pages emit timing (plan 92, Part 1) ──────────────
// A SEQUENCED frame (lane:"seq" + start/dur, e.g. after "Place in order") stamps the
// timeline attributes onto its own [data-pdf-page] so the sequence clock's [data-t-start]
// selector gates it — one slide at a time. A spatial (untimed) frame stamps NONE, so every
// frame shows. This is the hook half of the feature; the gating itself is sequence-dom's.

test('sequenced frames → each [data-pdf-page] carries data-t-start / data-t-dur (ms)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', lane: 'seq', start: 0, dur: 3, enter: 'fade', exit: 'fade' },
    { id: 'fb', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff', lane: 'seq', start: 3, dur: 3, enter: 'fade', exit: 'fade' },
  ]);
  const doc = new JSDOM(html).window.document;
  const pages = [...doc.querySelectorAll('[data-pdf-page]')] as HTMLElement[];
  assert.equal(pages.length, 2, 'two frame pages');
  // ms on the wire: start/dur are authored in SECONDS, emitted *1000.
  assert.equal(pages[0]!.getAttribute('data-t-start'), '0');
  assert.equal(pages[0]!.getAttribute('data-t-dur'), '3000');
  assert.equal(pages[1]!.getAttribute('data-t-start'), '3000');
  assert.equal(pages[1]!.getAttribute('data-t-dur'), '3000');
  // the scenes lane + the transition ride along too.
  assert.equal(pages[0]!.getAttribute('data-t-lane'), 'seq');
  assert.equal(pages[0]!.getAttribute('data-t-enter'), 'fade');
  assert.equal(pages[1]!.getAttribute('data-t-exit'), 'fade');
});

test('spatial (untimed) frames emit NO data-t-* on their pages — every frame shows', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'fb', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff' },
  ]);
  assert.ok(!/data-t-start/.test(html), 'no timing attribute on an unsequenced frame doc');
  const doc = new JSDOM(html).window.document;
  for (const page of doc.querySelectorAll('[data-pdf-page]')) {
    assert.equal((page as HTMLElement).getAttribute('data-t-start'), null);
  }
});

// ── FRAME (ARTBOARD) STROKE — a real exported border, ISSUE 2b ─────────────────────

test('a frame with stroke+strokeW renders a REAL border on its [data-pdf-page] page', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, shape: 'rect', bg: '#ffffff', stroke: '#123456', strokeW: 3 },
    { id: 't', kind: 'text', x: 40, y: 40, w: 200, h: 80, text: 'Hi', fontSize: 32, frame: 'f1' },
  ]);
  // The page div carries a solid border from stroke/strokeW, inside-box (border-box).
  assert.match(html, /data-pdf-page[^>]*style="[^"]*border:3px solid #123456/,
    'the artboard page renders its stroke as a CSS border (exported by the walkers)');
  assert.match(html, /data-pdf-page[^>]*style="[^"]*box-sizing:border-box/,
    'the border is an inside stroke, so children keep their frame-local coords');
  // The inside border insets the page's PADDING box (the containing block for its abs
  // children) by border-width. The child's frame-local origin is therefore reduced by the
  // stroke width so it paints at its MODEL coordinate, not model+strokeW. text 't' is at
  // model (40,40) in a frame at (0,0) with a 3px stroke → 40-0-3 = 37.
  assert.match(html, /data-box-id="t"[^>]*style="[^"]*left:37px;top:37px;"/,
    'a member of a stroked frame is compensated by the border width (no strokeW drift)');
});

test('a strokeless frame does NOT compensate its members (left = box.x - frame.x)', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, shape: 'rect', bg: '#ffffff' },
    { id: 't', kind: 'text', x: 40, y: 40, w: 200, h: 80, text: 'Hi', fontSize: 32, frame: 'f1' },
  ]);
  // No border → no containing-block inset → no compensation: 40-0-0 = 40.
  assert.match(html, /data-box-id="t"[^>]*style="[^"]*left:40px;top:40px;"/,
    'a member of an unstroked frame keeps its plain frame-local coords');
});

test('a frame with NO stroke renders no border (fill only)', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, shape: 'rect', bg: '#ffffff' },
    { id: 't', kind: 'text', x: 40, y: 40, w: 200, h: 80, text: 'Hi', fontSize: 32, frame: 'f1' },
  ]);
  const page = /(<[^>]*data-pdf-page[^>]*>)/.exec(html)?.[1] ?? '';
  assert.ok(page, 'a page div exists');
  assert.ok(!/border:/.test(page), 'no border emitted when the frame declares no stroke');
});

test('a frame stroke honours the dashed style', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, shape: 'rect', stroke: '#000000', strokeW: 2, strokeDash: 'dashed' },
  ]);
  assert.match(html, /data-pdf-page[^>]*style="[^"]*border:2px dashed #000000/, 'dashed frame border');
});
