// SPDX-License-Identifier: MPL-2.0
/**
 * Design - hand-authored frames render as per-frame [data-pdf-page] (plan 93 F1a-part-2).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Loads the REAL tool from disk and drives it through the engine with a stub host, so
 * these guard the tool's actual render. Design ships in two packs - the private
 * brands/suse one and the public community one - with byte-identical
 * hooks.js/template.html (only tool.json + brand fonts differ). We load from
 * community/ (always present in a public checkout; brands/suse is a private
 * submodule CI skips), so the suite never silently skips.
 *
 * The contract:
 *   - NO-FRAMES BYTE-IDENTITY (the centerpiece): with only non-frame boxes the output is
 *     exactly today's single .artboard, {{#each boxes}}, global coords - ZERO [data-pdf-page].
 *   - FRAMES-PRESENT: each kind:"frame" box becomes one [data-pdf-page] sized to the frame's
 *     w×h; members (box.frame === frame.id) render at frame-LOCAL coords; page order is
 *     ascending `order`, tie-break ascending x.
 *   - PASTEBOARD (F1b-2): a non-frame box with frame==="" (or a frame id matching no page)
 *     renders LOOSE at global coords under the frames wrapper, OUTSIDE every [data-pdf-page]
 * - visible in the editor, excluded from the per-page export by construction.
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
import { makeColorApi } from '../engine/src/color-tools.ts';
import { baseHost } from './helpers/host.ts';

// Public community pack - present in every checkout (brands/suse is private + CI-skipped).
const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

async function mount(boxes: unknown[], hostOverrides: Record<string, unknown> = {}) {
  const rt = await createRuntime(tool, baseHost(hostOverrides), { boxes: boxes as never });
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
  // No paged output at all - the sacred invariant.
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
  assert.match(html, /data-pdf-page data-frame-id="fa" style="position:absolute;left:0px;top:0px;width:800px;height:600px/, 'frame fa page is 800×600 at (0,0)');
  assert.match(html, /data-pdf-page data-frame-id="fb" style="position:absolute;left:1000px;top:0px;width:400px;height:400px/, 'frame fb page is 400×400 at (1000,0)');
  // The frame-kind boxes are pages, never also rendered as child boxes.
  assert.ok(!html.includes('data-box-id="fa"'), 'frame fa is not also a child box');
  assert.ok(!html.includes('data-box-id="fb"'), 'frame fb is not also a child box');
});

test('each frame page carries data-frame-id (box id; index fallback) - deep-link + timeline label (plan 112)', async () => {
  const html = await mount([
    { id: 'intro', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff' }, // no id → flat-index fallback
  ]);
  const doc = new JSDOM(html).window.document;
  const pages = [...doc.querySelectorAll('[data-pdf-page]')] as HTMLElement[];
  assert.equal(pages.length, 2, 'two frame pages');
  // A frame with an id stamps that id (the reorder-proof deep-link address `?s=intro`).
  assert.equal(pages[0]!.getAttribute('data-frame-id'), 'intro');
  // An id-less frame still stamps a stable id (its flat index) so present mode and the
  // timeline can always resolve a page - never a blank attribute.
  assert.equal(pages[1]!.getAttribute('data-frame-id'), '1');
});

test('present-mode authoring stamps: data-build on a fragment child, data-present-audio on an opted-in video (plan 112)', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'bullet', kind: 'text', x: 20, y: 20, w: 200, h: 40, text: 'Point', fontSize: 24, frame: 'f', build: 2 },
    { id: 'always', kind: 'text', x: 20, y: 80, w: 200, h: 40, text: 'Always', fontSize: 24, frame: 'f' },
    { id: 'clip', kind: 'box', x: 20, y: 140, w: 200, h: 120, frame: 'f', image: { url: 'movie.mp4', type: 'video' }, presentAudio: true },
  ]);
  const doc = new JSDOM(html).window.document;
  // A child with a build number becomes a fragment; a child without stamps nothing.
  assert.equal(doc.querySelector('[data-box-id="bullet"]')!.getAttribute('data-build'), '2', 'build child stamps data-build');
  assert.equal(doc.querySelector('[data-box-id="always"]')!.getAttribute('data-build'), null, 'a no-build child stamps no data-build');
  // A video box opted into present audio stamps the unmute flag (still muted in the DOM).
  const video = doc.querySelector('video[data-video-key="clip"]');
  assert.ok(video, 'the video box renders a <video>');
  assert.equal(video!.getAttribute('data-present-audio'), '1', 'opted-in video stamps data-present-audio');
  assert.ok(video!.hasAttribute('muted'), 'the video is still emitted muted (present mode unmutes at runtime)');
});

test('the present-audio opt-in reads the STRING a URL carries, not bare truthiness', async () => {
  // `presentAudio=false` arrives as the string "false", which is truthy in JS - the trap
  // every boolean field in the hook reads through boolVal to avoid. Getting it wrong
  // unmutes a box at the podium whose author had turned the opt-in off.
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff' },
    { id: 'off', kind: 'box', x: 0, y: 0, w: 200, h: 120, frame: 'f', image: { url: 'a.mp4', type: 'video' }, presentAudio: 'false' },
    { id: 'zero', kind: 'box', x: 0, y: 140, w: 200, h: 120, frame: 'f', image: { url: 'b.mp4', type: 'video' }, presentAudio: '0' },
    { id: 'on', kind: 'box', x: 0, y: 280, w: 200, h: 120, frame: 'f', image: { url: 'c.mp4', type: 'video' }, presentAudio: '1' },
  ]);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('video[data-video-key="off"]')!.hasAttribute('data-present-audio'), false);
  assert.equal(doc.querySelector('video[data-video-key="zero"]')!.hasAttribute('data-present-audio'), false);
  assert.equal(doc.querySelector('video[data-video-key="on"]')!.getAttribute('data-present-audio'), '1');
});

test('frame `state` → sanitised data-frame-state on the page (plan 112 M4)', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, state: 'Dark  Title!! @#$"' },
    { id: 'g', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1 },
  ]);
  const doc = new JSDOM(html).window.document;
  const pages = [...doc.querySelectorAll('[data-pdf-page]')] as HTMLElement[];
  // lowercased, punctuation/quotes stripped (keeps a–z 0–9 -), whitespace collapsed.
  assert.equal(pages[0]!.getAttribute('data-frame-state'), 'dark title');
  assert.equal(pages[1]!.getAttribute('data-frame-state'), null, 'no state → no attribute');
});

test('per-box `cls` → extra class tokens on the box, in every branch (plan 112 M4)', async () => {
  // The Custom CSS companion: an author's own class names, so a rule says `.callout {…}`
  // rather than addressing a ULID. It must reach ALL THREE render branches - a page child,
  // a pasteboard box, and the no-frames artboard - because a class that works while a doc
  // has frames and stops when it doesn't is a class nobody can rely on.
  const framed = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0 },
    { id: 'member', kind: 'text', x: 20, y: 20, w: 200, h: 40, text: 'In', frame: 'f', cls: 'callout hero' },
    { id: 'loose', kind: 'text', x: 900, y: 20, w: 200, h: 40, text: 'Out', frame: '', cls: 'scratch' },
  ]);
  const fdoc = new JSDOM(framed).window.document;
  const member = fdoc.querySelector('[data-box-id="member"]')!;
  assert.deepEqual([...member.classList].sort(), ['callout', 'hero', 'lolly-box']);
  assert.deepEqual([...fdoc.querySelector('[data-box-id="loose"]')!.classList].sort(), ['lolly-box', 'scratch']);

  const flat = await mount([{ id: 'a', kind: 'box', x: 0, y: 0, w: 100, h: 100, cls: 'callout' }]);
  const adoc = new JSDOM(flat).window.document;
  assert.deepEqual([...adoc.querySelector('[data-box-id="a"]')!.classList].sort(), ['callout', 'lolly-box']);
});

test('`cls` is parsed and re-serialised, never passed through (plan 112 M4)', async () => {
  const html = await mount([
    // Quote-escape attempt, punctuation, uppercase, a digit-leading token, duplicates,
    // and the app's own namespaces - the class attribute is authored by the DOCUMENT, so
    // it is a sanitiser boundary like every other free-text field the hook emits.
    { id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, cls: '"><script>x</script> Big.Callout 2cool big big lolly-frames seq-off pr-active fc-panel keep_me' },
    { id: 'b', kind: 'box', x: 20, y: 0, w: 10, h: 10 },
  ]);
  assert.doesNotMatch(html, /<script>x<\/script>/, 'no markup can escape the class attribute');
  const doc = new JSDOM(html).window.document;
  assert.deepEqual([...doc.querySelector('[data-box-id="a"]')!.classList],
    ['lolly-box', 'scriptxscript', 'bigcallout', 'big', 'keep_me'],
    'lowercased, cleaned to [a-z0-9_-], de-duplicated; a digit-leading token and the app namespaces are DROPPED, never renamed');
  assert.deepEqual([...doc.querySelector('[data-box-id="b"]')!.classList], ['lolly-box'],
    'no cls → the class list is exactly what it always was');
});

test('frame `notes` → attribute-escaped data-frame-notes, never on the slide (plan 112 M5)', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, notes: 'Say "hi" & <wave>\nline two' },
    { id: 'g', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1 },
  ]);
  const doc = new JSDOM(html).window.document;
  const pages = [...doc.querySelectorAll('[data-pdf-page]')] as HTMLElement[];
  // The value round-trips verbatim through getAttribute (escaping is transparent to the reader).
  assert.equal(pages[0]!.getAttribute('data-frame-notes'), 'Say "hi" & <wave>\nline two');
  assert.equal(pages[1]!.getAttribute('data-frame-notes'), null, 'no notes → no attribute');
  // The angle-bracketed token must NOT have opened a real element on the slide (escaping held).
  assert.equal(doc.querySelector('wave'), null, 'notes text is not parsed as slide markup');
  // Notes never appear in the slide's visible text.
  assert.equal(pages[0]!.textContent?.includes('line two'), false, 'notes are not rendered on the slide');
});

test('page ORDER follows `order` asc (then x) - fb(order 0) before fa(order 1)', async () => {
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
  assert.match(html, /data-pdf-page data-frame-id="fa" style="position:absolute;left:200px;top:100px;width:800px;height:600px/, 'page sits at its authored (200,100)');
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

test('a scratch box (frame==="") renders LOOSE - child of the canvas root, NOT any page', async () => {
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
    'the scratch box is OUTSIDE every [data-pdf-page] - excluded from per-page export by construction');
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
  assert.match(html, /data-pdf-page data-frame-id="fa" style="position:absolute;left:0px;top:0px;width:800px;height:600px;background:#ffffff;overflow:hidden;/, 'clips by default');
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
// selector gates it - one slide at a time. A spatial (untimed) frame stamps NONE, so every
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

test('spatial (untimed) frames emit NO data-t-* on their pages - every frame shows', async () => {
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

// ── FRAME (ARTBOARD) STROKE - a real exported border, ISSUE 2b ─────────────────────

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

// ── FRAME (ARTBOARD) PAINT - the fills a board was offered and never rendered ──────
//
// plan 179 A3/A4. The inspector has always offered an artboard a gradient, a picture,
// opacity, a blend, a corner radius and a shadow; frameGroupsFor emitted only
// left/top/width/height/background/border/overflow, so every one of those controls wrote
// a model value that painted nothing. These pin that each now reaches the page element,
// INLINE (the SVG/PDF/raster walkers read the style attribute, never a stylesheet).

/** The opening tag of the first [data-pdf-page] in a render. */
const pageTag = (html: string): string => /(<[^>]*data-pdf-page[^>]*>)/.exec(html)?.[1] ?? '';

test('a frame with grad + image + opacity + radius + shadow paints EVERY one of them', async () => {
  const html = await mount([
    {
      id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0,
      bg: '#123456',
      grad: 'lin_90_30ba78-0_efefef-100',
      image: { url: 'photo.png' },
      fit: 'cover',
      imgpos: 'left top',
      opacity: 50,
      blend: 'multiply',
      shape: 'rounded', radius: 24,
      shadow: 'box', shadowColor: '#00000055', shadowX: 0, shadowY: 8, shadowBlur: 20,
    },
    { id: 't', kind: 'text', x: 40, y: 40, w: 200, h: 80, text: 'Hi', fontSize: 32, frame: 'f1' },
  ], { color: makeColorApi() });

  const page = pageTag(html);
  assert.ok(page, 'a page div exists');
  // The flat fill stays, and the gradient is written AFTER it (the `background` shorthand
  // resets background-image, so the order is what makes a translucent stop composite).
  assert.ok(page.includes('background:#123456;'), `flat fill kept: ${page}`);
  const bgAt = page.indexOf('background:#123456');
  const gradAt = page.indexOf('background-image:linear-gradient(90deg,');
  assert.ok(gradAt > bgAt, `the gradient paints over the flat fill: ${page}`);
  assert.ok(page.includes('#30ba78 0%') && page.includes('#efefef 100%'),
    'the authored stops travel verbatim (OKLab-baked to plain sRGB)');
  // Opacity, blend, radius and the box shadow.
  assert.match(page, /opacity:0\.5;/, 'opacity 50 → 0.5');
  assert.match(page, /mix-blend-mode:multiply;/, 'the blend mode reaches the page');
  assert.match(page, /border-radius:24px;/, 'shape rounded + radius 24 → a real corner radius');
  assert.match(page, /box-shadow:0px 8px 20px #00000055;/, 'the shadow fields reach the page');
  assert.match(page, /overflow:hidden;/, 'clipChildren default still clips the board');

  // The image fill is a REAL <img>, the page's FIRST child, so it paints under every
  // member box and the walkers export it like any other picture.
  const doc = new JSDOM(html).window.document;
  const pageEl = doc.querySelector('[data-pdf-page]') as HTMLElement;
  const first = pageEl.firstElementChild as HTMLElement;
  assert.equal(first.tagName, 'IMG', 'the picture layer is the page\'s first child');
  assert.ok(first.classList.contains('lolly-frame-img'), 'it carries the .lolly-frame-img hook');
  assert.equal(first.getAttribute('src'), 'photo.png');
  const istyle = first.getAttribute('style') ?? '';
  assert.match(istyle, /position:absolute;left:0;top:0;width:100%;height:100%/, 'sized to the page');
  assert.match(istyle, /object-fit:cover;/, 'the frame\'s own fit');
  assert.match(istyle, /object-position:left top;/, 'the frame\'s own image position');
  assert.match(istyle, /border-radius:24px;/, 'the picture wears the board\'s corner radius');
  assert.match(istyle, /pointer-events:none;/, 'paint, never a hit target');
  // …and the member box still follows it, so the picture is BEHIND the content.
  assert.equal(pageEl.querySelector('[data-box-id="t"]')?.previousElementSibling, first,
    'the member box sits after the picture layer in paint order');
});

test('a plain frame emits NONE of the new declarations (the pre-179 page, byte for byte)', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, shape: 'rect', bg: '#ffffff' },
  ]);
  const page = pageTag(html);
  assert.equal(
    /style="([^"]*)"/.exec(page)?.[1],
    'position:absolute;left:0px;top:0px;width:800px;height:600px;background:#ffffff;overflow:hidden;',
    'an unpainted board serialises exactly as it did before A3/A4',
  );
  assert.ok(!html.includes('lolly-frame-img'), 'no picture layer without an image');
});

test('a frame image degrades to NO layer for a video / lottie / audio asset', async () => {
  for (const image of [
    { url: 'movie.mp4', type: 'video' },
    { url: 'anim.json', type: 'lottie' },
    { url: 'blob:bed', type: 'audio' },
  ]) {
    const html = await mount([
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff', image },
    ]);
    assert.ok(!html.includes('lolly-frame-img'),
      `${image.type} needs the shell's own enhancer, so a board takes no <img> layer for it`);
  }
});

test('a shape:rect frame emits no border-radius at all (0 is not a declaration)', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 400, h: 400, shape: 'rect', radius: 40, bg: '#ffffff' },
  ]);
  assert.ok(!/border-radius/.test(pageTag(html)), 'a square board says nothing about its corners');
});

// ── FRAME NAME - the label the canvas can finally read back (plan 179 A10) ─────────

test('a frame `name` → attribute-escaped data-frame-name on the page', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff', name: 'Cover & "intro" <slide>' },
    { id: 'f2', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, bg: '#ffffff' },
  ]);
  const doc = new JSDOM(html).window.document;
  const pages = doc.querySelectorAll('[data-pdf-page]');
  assert.equal(pages.length, 2);
  assert.equal((pages[0] as HTMLElement).getAttribute('data-frame-name'), 'Cover & "intro" <slide>',
    'the name survives the attribute escape intact');
  assert.equal((pages[1] as HTMLElement).getAttribute('data-frame-name'), null,
    'an unnamed board stamps nothing - the label fallback is unchanged');
  // Escaped in the SOURCE, so the name can never open an attribute or a tag.
  assert.ok(html.includes('data-frame-name="Cover &amp; &quot;intro&quot; &lt;slide&gt;"'), html.slice(0, 400));
});

test('a whitespace-only frame name stamps nothing', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff', name: '   ' },
  ]);
  assert.ok(!html.includes('data-frame-name'), 'blank is not a name');
});

// ── ONE PAPER PER DOCUMENT (plan 179 A6) ──────────────────────────────────────────
//
// The default document seeds artboard-1 as brand paper with no stroke; the Artboard
// add-kind used to seed #fafbfe plus a baked 2px #dfe3ec border. So the second board a
// user drew never matched the first, and the grey edge could not be removed from any UI
// (the stroke controls are gated on paths). Same paper, no stroke, one document.

test('the Artboard add-kind seeds the SAME paper as the default artboard-1', () => {
  const boxesInput = (tool.manifest.inputs as Array<any>).find(i => i.id === 'boxes');
  const seed = (boxesInput.canvas.addKinds as Array<any>).find(k => k.id === 'frame')?.seed;
  assert.ok(seed, 'canvas.addKinds has a frame (Artboard) entry');
  const dflt = (boxesInput.default as Array<any>).find(b => b.kind === 'frame');
  assert.ok(dflt, 'the boxes default seeds an artboard');
  assert.equal(seed.kind, 'frame');
  assert.equal(seed.shape, 'rect', 'a board is still drawn square-cornered');
  assert.equal(seed.bg, dflt.bg, 'a drawn board is the same paper as the document default');
  assert.ok(!('stroke' in seed) && !('strokeW' in seed),
    'no baked border: the stroke controls cannot reach a frame, so it must not be born wearing one');
});
