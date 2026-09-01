// SPDX-License-Identifier: MPL-2.0
/**
 * Design - the native-PPTX deck model emitter (plan 95 route-a).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * "Design" is Design. A SLIDE is a FRAME; a slide deck is N frames. When frames
 * exist the hook emits, ALONGSIDE the unchanged [data-pdf-page] HTML render, a
 * <script type="application/json" data-pptx-deck> carrying a deck-studio-shaped model
 * ({ size, slides:[{ bg, elements }] }). export-pptx.ts reads that off the export node
 * and lowers it (pptx-deck.ts, UNCHANGED) into a REAL editable .pptx - so the whole path
 * is headlessly verifiable: the emitter runs DOM-free in the hook.
 *
 * The contract asserted here:
 *   - A no-frames doc emits NO deck model (pptx falls back to export-pptx's DOM walk).
 *   - Frames present → one slide per frame, in the page order (order asc, tie-break x),
 *     each slide bg = the frame bg (concrete hex, never the var(...) page-render string).
 *   - Each non-frame child lowers to a deck element at FRAME-LOCAL coords: a text box →
 *     {t:'text', paras:[{runs:[{text, sizePt=px*0.75, bold}]}]}; a box → {t:'rect', fill,
 *     radius}; a still image → {t:'image', src}.
 *   - Inexpressible kinds/effects (path, lottie/video image, rotation/gradient) emit
 *     nothing native (rasterise-to-image is a documented follow-up).
 *
 * Loaded from community/ (always present; brands/suse is a private, CI-skipped
 * submodule) exactly like design-frames.test.ts.
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

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

// Pull the deck model JSON out of the hydrated render, or null when absent.
function deckOf(html: string): any {
  const doc = new JSDOM(html).window.document;
  const el = doc.querySelector('[data-pptx-deck]');
  if (!el) return null;
  const raw = el.textContent ?? '';
  return JSON.parse(raw);
}

// ── no frames → no deck model (the DOM-walk fallback covers a single design) ────

test('a no-frames design emits NO [data-pptx-deck] script', async () => {
  const html = await mount([
    { id: 'a', kind: 'box', x: 120, y: 80, w: 300, h: 200, shape: 'rect', bg: '#30BA78' },
    { id: 'b', kind: 'text', x: 500, y: 400, w: 400, h: 200, text: 'Hi', fontSize: 48 },
  ]);
  assert.equal(deckOf(html), null, 'no deck model when there are no frames');
  assert.ok(!html.includes('data-pptx-deck'), 'the deck script node is absent');
});

// ── frames → one slide per frame, ordered, with the expected elements ──────────

test('two frames → deck.slides.length === 2, in page order (order asc)', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 1, bg: '#ffffff' },
    { id: 'fb', kind: 'frame', x: 1160, y: 0, w: 1080, h: 1080, order: 0, bg: '#0b1220' },
    { id: 'ca', kind: 'text', x: 100, y: 200, w: 800, h: 300, text: 'On A', fontSize: 96, weight: '700', frame: 'fa' },
    { id: 'cb', kind: 'box', x: 1260, y: 160, w: 400, h: 200, shape: 'rounded', radius: 24, bg: '#30ba78', frame: 'fb' },
  ]);
  const deck = deckOf(html);
  assert.ok(deck, 'a deck model is emitted');
  assert.equal(deck.slides.length, 2, 'one slide per frame');
  // One slide size (first frame after the sort): 1080×1080.
  assert.deepEqual(deck.size, { w: 1080, h: 1080 }, 'deck carries the first frame size');
  // Page order: fb (order 0) before fa (order 1). Its bg is the frame bg, concrete hex.
  assert.equal(deck.slides[0].bg, '#0b1220', 'slide 0 is frame fb (order 0)');
  assert.equal(deck.slides[1].bg, '#ffffff', 'slide 1 is frame fa (order 1)');
  assert.ok(!JSON.stringify(deck).includes('var('), 'no CSS var(...) leaks into a deck colour');
});

test('a text child → a deck text element at FRAME-LOCAL coords with the right run', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 200, y: 100, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'ca', kind: 'text', x: 300, y: 260, w: 800, h: 300, text: 'Hello deck', fontSize: 96, weight: '700', align: 'left', valign: 'top', fg: '#123456', frame: 'fa' },
  ]);
  const deck = deckOf(html);
  const els = deck.slides[0].elements;
  assert.equal(els.length, 1, 'one element on the slide');
  const t = els[0];
  assert.equal(t.t, 'text', 'it is a text element');
  // Frame-local: 300-200 = 100, 260-100 = 160.
  assert.equal(t.x, 100, 'frame-local x = box.x - frame.x');
  assert.equal(t.y, 160, 'frame-local y = box.y - frame.y');
  assert.equal(t.w, 800);
  assert.equal(t.h, 300);
  assert.equal(t.anchor, 't', 'valign top → anchor t');
  const para = t.paras[0];
  assert.equal(para.align, 'l', 'align left → l');
  const run = para.runs[0];
  assert.equal(run.text, 'Hello deck');
  assert.equal(run.sizePt, 72, 'sizePt = 96px * 0.75');
  assert.equal(run.color, '#123456');
  assert.equal(run.bold, true, 'weight 700 → bold');
});

test('a box child → a deck rect with fill + radius at frame-local coords', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'r', kind: 'box', x: 40, y: 60, w: 300, h: 200, shape: 'rounded', radius: 18, bg: '#30ba78', frame: 'fa' },
  ]);
  const rect = deckOf(html).slides[0].elements[0];
  assert.equal(rect.t, 'rect');
  assert.equal(rect.x, 40);
  assert.equal(rect.y, 60);
  assert.equal(rect.w, 300);
  assert.equal(rect.h, 200);
  assert.equal(rect.fill, '#30ba78', 'the box bg is the rect fill');
  assert.equal(rect.radius, 18, 'a rounded box carries its px radius');
});

test('a light (thin weight) text child → run.bold false', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'ca', kind: 'text', x: 0, y: 0, w: 400, h: 120, text: 'thin', fontSize: 40, weight: '300', frame: 'fa' },
  ]);
  const run = deckOf(html).slides[0].elements[0].paras[0].runs[0];
  assert.equal(run.bold, false, 'weight 300 (< 600) is not bold');
});

// ── inexpressible kinds/effects emit nothing native (rasterise follow-up) ──────

test('a rotated box + a path box + a plain box → only the plain box lowers', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'plain', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#111111', frame: 'fa' },
    { id: 'rot', kind: 'box', x: 200, y: 10, w: 100, h: 100, shape: 'rect', bg: '#222222', rot: 30, frame: 'fa' },
    { id: 'pen', kind: 'path', x: 400, y: 10, w: 100, h: 100, path: 'x', frame: 'fa' },
  ]);
  const els = deckOf(html).slides[0].elements;
  assert.equal(els.length, 1, 'only the plain, axis-aligned box is expressible');
  assert.equal(els[0].t, 'rect');
  assert.equal(els[0].fill, '#111111');
});

test('a box with opacity<100 is inexpressible → skipped native (no opaque drift)', async () => {
  // boxCss emits opacity:<1 for opacity!==100; the flat deck element carries no alpha,
  // so a translucent box must NOT lower to a fully-opaque rect. It is skipped (rasterise
  // follow-up), while its opacity:100 sibling lowers unchanged.
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'solid', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#111111', opacity: 100, frame: 'fa' },
    { id: 'ghost', kind: 'box', x: 200, y: 10, w: 100, h: 100, shape: 'rect', bg: '#30ba78', opacity: 50, frame: 'fa' },
  ]);
  const els = deckOf(html).slides[0].elements;
  assert.equal(els.length, 1, 'only the fully-opaque box lowers; the translucent one is skipped');
  assert.equal(els[0].fill, '#111111');
  assert.ok(!JSON.stringify(els).includes('#30ba78'), 'the 50%-opacity box does not leak an opaque deck rect');
});

test('the Slide deck TEMPLATE seeds a deck of 3 slides, each with a title + body', async () => {
  // Read the external template file's values directly and drive them through the hook - 
  // the path the gallery "Slide deck" tile takes (templates are per-file now:
  // tools/<id>/templates/<tid>.json, not inline in tool.json).
  const raw = await fetchFile('design/templates/slide-deck.json');
  const tpl = JSON.parse(raw);
  assert.equal(tpl.id, 'slide-deck', 'the slide-deck template file exists and is self-identifying');
  const html = await mount(tpl.values.boxes);
  const deck = deckOf(html);
  assert.ok(deck, 'the template emits a deck model');
  assert.equal(deck.slides.length, 3, 'three frames → three slides');
  for (const s of deck.slides) {
    const texts = s.elements.filter((e: any) => e.t === 'text');
    assert.ok(texts.length >= 2, 'each slide has a title + body text element');
  }
});

// ── native animation in the deck model (plans/175 WP-E) ─────────────────────────
//
// The hook carries a box's animation fields RAW (Lolly vocabulary) on the deck
// element's `anim`; the shell's pptx-deck.ts owns the mapping to PowerPoint's subset.
// What the hook must get right: attach only when something animates (a still deck's
// JSON is byte-identical to before), derive slide-local delays from the box's own
// timing, hand exits a concrete end moment, and let `build` become the click step.

const FRAME = { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff' };
const CHILD = { id: 'c1', kind: 'text', frame: 'f1', x: 100, y: 100, w: 400, h: 120, text: 'Hello brave world', fontSize: 40 };

test('anim: a still deck element carries NO anim key at all', async () => {
  const deck = deckOf(await mount([FRAME, CHILD]));
  assert.ok(deck, 'frames → deck model');
  assert.ok(!('anim' in deck.slides[0].elements[0]), 'nothing animates, nothing is carried');
});

test('anim: enter kind + timing lower to raw fields with a slide-local delay', async () => {
  const deck = deckOf(await mount([FRAME, { ...CHILD, enter: 'fade', enterMs: 500, enterEase: 'ease-in', start: 2, dur: 4 }]));
  const anim = deck.slides[0].elements[0].anim;
  assert.equal(anim.enter, 'fade');
  assert.equal(anim.enterMs, 500);
  assert.equal(anim.enterEase, 'ease-in');
  assert.equal(anim.delayMs, 2000, 'the box start becomes the slide-local delay');
});

test('anim: an exit gets its concrete end moment only from a timed box', async () => {
  const timed = deckOf(await mount([FRAME, { ...CHILD, exit: 'fade', exitMs: 400, start: 1, dur: 3 }]));
  const a1 = timed.slides[0].elements[0].anim;
  assert.equal(a1.exit, 'fade');
  assert.equal(a1.exitDelayMs, 3600, '(start+dur)·1000 − exitMs: the exit FINISHES at the box end');
  const untimed = deckOf(await mount([FRAME, { ...CHILD, exit: 'fade', exitMs: 400 }]));
  const a2 = untimed.slides[0].elements[0].anim;
  assert.equal(a2.exit, 'fade', 'the raw kind still travels');
  assert.ok(!('exitDelayMs' in a2), 'but with no derived moment - pptx-deck will skip it, loudly');
});

test('anim: split + stagger travel raw, letter degrades for joining scripts, build is the click', async () => {
  const deck = deckOf(await mount([FRAME,
    { ...CHILD, split: 'word', stagger: 80, splitOrder: 'reverse', build: 2 },
    { ...CHILD, id: 'c2', y: 300, text: 'مرحبا بالعالم', split: 'letter', stagger: 60 },
  ]));
  const a = deck.slides[0].elements[0].anim;
  assert.equal(a.enter, 'none', 'split with no kind is the cut - the typewriter trigger');
  assert.equal(a.split, 'word');
  assert.equal(a.stagger, 80);
  assert.equal(a.order, 'reverse');
  assert.equal(a.click, 2, 'the presentation build order becomes the click step');
  const ar = deck.slides[0].elements[1].anim;
  assert.equal(ar.split, 'word', 'letter degrades to word for joining scripts in the deck too');
});
