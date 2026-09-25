// SPDX-License-Identifier: MPL-2.0
/**
 * Design - the native-PPTX deck model emitter (plan 95 route-a).
 *
 * Run with: pnpm test  (node --test over the tests/ globs). No framework - node:test.
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
// The bridge half of the path (plan 179 P1/A12): the SHIPPING lowering functions and the
// engine's OOXML writer, so the notes/fill assertions below are made by the real code.
import { deckFill, deckNotes, deckSlideTransitions, deckSyncShape, deckTransition, emuOf, type DeckNotes } from '../shells/web/src/bridge/pptx-deck.ts';
import { buildPptxParts } from '../engine/src/pptx.ts';
import type { PptxSlide } from '../engine/src/pptx.ts';

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

test('a plain box and a turned box lower, a turned picture and an unreadable path do not', async () => {
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'plain', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#111111', frame: 'fa' },
    { id: 'rot', kind: 'box', x: 200, y: 10, w: 100, h: 100, shape: 'rect', bg: '#222222', rot: 30, frame: 'fa' },
    { id: 'pen', kind: 'path', x: 400, y: 10, w: 100, h: 100, path: 'x', frame: 'fa' },
    { id: 'pic', kind: 'image', x: 600, y: 10, w: 100, h: 100, image: { type: 'image', url: 'https://example.com/a.png' }, rot: 30, frame: 'fa' },
    { id: 'still', kind: 'image', x: 800, y: 10, w: 100, h: 100, image: { type: 'image', url: 'https://example.com/a.png' }, frame: 'fa' },
  ]);
  const els = deckOf(html).slides[0].elements;
  assert.equal(els.length, 3, 'the plain box, the turned box and the unturned picture are expressible');
  assert.equal(els[2].t, 'image', 'a picture lowers when it is not turned');
  assert.equal(els[0].t, 'rect');
  assert.equal(els[0].fill, '#111111');
  assert.equal(els[0].rot, undefined, 'an unturned box states no turn');
  assert.equal(els[1].rot, 30, 'a turned box carries its turn, which the deck shape draws about its centre');
});

test('a translucent box folds its opacity into its fill; one it cannot fold is skipped (no opaque drift)', async () => {
  // boxCss emits opacity:<1 for opacity!==100. A box with a literal fill and no outline
  // carries that opacity as the alpha of its fill (plan 275 decision 32); a box whose
  // colour cannot take an alpha (a token var) or whose outline would stay opaque is
  // still skipped, so nothing lowers to a fully-opaque rect the canvas draws faded.
  const html = await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'solid', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'rect', bg: '#111111', opacity: 100, frame: 'fa' },
    { id: 'ghost', kind: 'box', x: 200, y: 10, w: 100, h: 100, shape: 'rect', bg: '#30ba78', opacity: 50, frame: 'fa' },
    { id: 'outlined', kind: 'box', x: 400, y: 10, w: 100, h: 100, shape: 'rect', bg: '#ff0000', stroke: '#000000', strokeW: 2, opacity: 50, frame: 'fa' },
    { id: 'token', kind: 'box', x: 600, y: 10, w: 100, h: 100, shape: 'rect', bg: 'var(--brand-primary)', opacity: 50, frame: 'fa' },
    { id: 'tokenline', kind: 'box', x: 800, y: 10, w: 100, h: 100, shape: 'rect', bg: '#ff0000', stroke: 'var(--brand-primary)', strokeW: 2, opacity: 50, frame: 'fa' },
  ]);
  const els = deckOf(html).slides[0].elements;
  assert.equal(els.length, 3, 'the opaque box and both foldable translucent ones lower; the two token colours are skipped');
  assert.equal(els[0].fill, '#111111');
  assert.equal(els[1].fill, '#30ba7880', 'half opacity rides on the fill as its alpha pair');
  assert.equal(els[2].fill, '#ff000080');
  assert.deepEqual(els[2].line, { color: '#00000080', w: 2 }, 'the outline takes the same alpha as the fill');
  assert.ok(!JSON.stringify(els).includes('var(--brand-primary)'), 'a colour that cannot take an alpha does not leak an opaque shape');
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

// ── SPEAKER NOTES (plan 179 P1) ───────────────────────────────────────────────
//
// The deck model had no `notes` key, so every note an author wrote was dropped on export
// and the whole notesSlide writer in engine/src/pptx.ts was unreachable from Design.
// The frame's own `notes` field - the same text stamped as data-frame-notes for the
// speaker view - now travels on the slide it belongs to.

test('a frame with notes → the deck slide carries them as plain text', async () => {
  const deck = deckOf(await mount([
    { ...FRAME, notes: 'Open with the customer story. Pause after the number.' },
    CHILD,
  ]));
  assert.equal(deck.slides[0].notes, 'Open with the customer story. Pause after the number.');
});

test('notes travel PER SLIDE, and a note-less slide carries no key at all', async () => {
  const deck = deckOf(await mount([
    { ...FRAME, id: 'fa', notes: 'Say this on one.' },
    { ...FRAME, id: 'fb', x: 1400, order: 1 },
    { ...FRAME, id: 'fc', x: 2800, order: 2, notes: '   ' },
  ]));
  assert.equal(deck.slides[0].notes, 'Say this on one.');
  // `undefined`, never '' - JSON.stringify drops the key, so the deck JSON of a deck with
  // no notes is byte-identical to what it was before P1.
  assert.ok(!('notes' in deck.slides[1]), 'slide 2 has no notes key');
  assert.ok(!('notes' in deck.slides[2]), 'whitespace is not a note');
});

test('the notes text is the frame\'s own, untouched - markup is not markup here', async () => {
  // A pptx notes slide is a TEXT body, so the value travels verbatim (no escaping, no
  // HTML) - the opposite of the data-frame-notes attribute stamp, which must escape.
  const deck = deckOf(await mount([{ ...FRAME, notes: '5 < 6 & "quote" <b>not bold</b>' }, CHILD]));
  assert.equal(deck.slides[0].notes, '5 < 6 & "quote" <b>not bold</b>');
});

// ── …and the notes reach a REAL .pptx notesSlide part (plan 179 P1) ───────────
//
// The hook emitting `notes` is only half of P1: the bridge has to lower it and the
// engine has to emit the parts. renderPptxFromDeck is DOM-bound (its image elements
// fetch bytes), so this drives its EXACT pure path instead - pptx-deck's own deckNotes
// + deckFill + deckSyncShape, then the engine's buildPptxParts - over the deck model
// the real tool just produced. Nothing here is a re-implementation of a rule: every
// decision is made by the shipping function.

test('P1 end to end: a frame with notes → a notesSlide part in the built OOXML', async () => {
  const deck = deckOf(await mount([
    { ...FRAME, id: 'fa', notes: 'Open with the customer story.\nPause after the number.' },
    { ...CHILD, frame: 'fa' },
    { ...FRAME, id: 'fb', x: 1400, order: 1 },
  ]));
  assert.equal(deck.slides.length, 2);

  const slides = deck.slides.map((s: any) => ({
    shapes: [
      ...(deckFill(s.bg) ? [{ kind: 'rect' as const, x: 0, y: 0, cx: emuOf(1280), cy: emuOf(720), fill: deckFill(s.bg)! }] : []),
      ...(s.elements as any[]).map((el) => deckSyncShape(el)).filter(Boolean),
    ],
    media: [],
    ...(deckNotes(s.notes) ? { notes: deckNotes(s.notes)! } : {}),
  })) as PptxSlide[];

  assert.equal(slides[0]!.notes, 'Open with the customer story.\nPause after the number.');
  assert.ok(!('notes' in slides[1]!), 'the note-less frame stays note-less through the lowering');

  const parts = buildPptxParts(slides, { emuW: emuOf(1280), emuH: emuOf(720) });
  assert.ok('ppt/notesSlides/notesSlide1.xml' in parts, 'slide 1 gets its notesSlide part');
  assert.ok(!('ppt/notesSlides/notesSlide2.xml' in parts), 'slide 2 has nothing to say, so no part');
  const notesXml = parts['ppt/notesSlides/notesSlide1.xml'] as string;
  assert.match(notesXml, /<a:t>Open with the customer story\.<\/a:t>/);
  assert.match(notesXml, /<a:t>Pause after the number\.<\/a:t>/, 'each line is its own paragraph');
  // The parts a reader needs to see the pane at all, emitted only because a note exists.
  assert.ok('ppt/notesMasters/notesMaster1.xml' in parts);
  assert.match(parts['ppt/slides/_rels/slide1.xml.rels'] as string, /notesSlides\/notesSlide1\.xml/);
  assert.ok(!/notesSlide/.test(parts['ppt/slides/_rels/slide2.xml.rels'] as string));
  assert.match(parts['[Content_Types].xml'] as string, /notesSlide\+xml/);
});

// ── A12: a token-valued artboard fill still reaches the slide background ──────

test('A12: a var() artboard fill lowers to a real background rect', () => {
  // The default document's fill IS a brand token; deckFill used to return undefined for
  // it, so the slide got no background rect at all. With no resolver the literal
  // fallback stands, which is exactly what a CLI/node export sees.
  const bg = deckFill('var(--brand-surface, #0C322C)');
  assert.deepEqual(bg, { solid: '0C322C', alpha: undefined });
  const parts = buildPptxParts(
    [{ shapes: [{ kind: 'rect', x: 0, y: 0, cx: emuOf(1280), cy: emuOf(720), fill: bg! }], media: [] }],
    { emuW: emuOf(1280), emuH: emuOf(720) },
  );
  assert.match(parts['ppt/slides/slide1.xml'] as string, /<a:srgbClr val="0C322C"\/>/);
});

// ── M4: slide transitions reach PowerPoint as PowerPoint's own ────────────────
// A Design deck's per-slide Fade/Slide used to stop at the door: the deck model carried
// it and the .pptx writer had nowhere to put it, so every deck opened as a deck of cuts.
// Three things are pinned here - the mapping, the index shift (a Lolly slide says how it
// leaves, a PowerPoint slide says how it arrives), and the byte-identity floor.

test('deckTransition maps the five values, and says what it could not carry', () => {
  assert.deepEqual(deckTransition('fade'), { kind: 'fade' });
  // 'l' is the direction that reads the way Lolly's Slide does: the arriving slide comes
  // in from the right and everything travels leftwards.
  assert.deepEqual(deckTransition('slide'), { kind: 'push', dir: 'l' });
  // A cut, an unresolved '', a per-box timeline, and junk all mean "no transition".
  assert.equal(deckTransition('none'), undefined);
  assert.equal(deckTransition('custom'), undefined);
  assert.equal(deckTransition(''), undefined);
  assert.equal(deckTransition('constructor'), undefined);
  assert.equal(deckTransition(null), undefined);

  // Morph and flight fall back to a fade, and the fallback is NAMED at warn level.
  const notes: DeckNotes = { mapped: [], dropped: [] };
  assert.deepEqual(deckTransition('morph', notes), { kind: 'fade' });
  assert.deepEqual(deckTransition('flight', notes), { kind: 'fade' });
  assert.equal(notes.mapped.length, 0, 'a substitution this big is a warn, not an info');
  assert.ok(notes.dropped.some((n) => n.includes('Morph')), `${notes.dropped}`);
  assert.ok(notes.dropped.some((n) => n.includes('Fly between artboards')), `${notes.dropped}`);
  // The same note never stacks twice.
  deckTransition('morph', notes);
  assert.equal(notes.dropped.filter((n) => n.includes('Morph')).length, 1);
});

test('the transition shifts by one slide: slide 1 plays what slide 0 authored', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', slideTransition: 'slide' },
    { id: 'f2', kind: 'frame', x: 1360, y: 0, w: 1280, h: 720, order: 1, bg: '#0b1220', slideTransition: 'fade' },
    { id: 'f3', kind: 'frame', x: 2720, y: 0, w: 1280, h: 720, order: 2, bg: '#123456', slideTransition: 'none' },
  ]);
  const deck = deckOf(html);
  assert.deepEqual(deck.slides.map((s: any) => s.transition), ['slide', 'fade', 'none'],
    'the hook carries each frame OWN transition (how it leaves)');

  const transitions = deckSlideTransitions(deck.slides);
  assert.deepEqual(transitions, [
    undefined,                    // slide 0 has no predecessor, so it never gets one
    { kind: 'push', dir: 'l' },   // …what slide 0 authored
    { kind: 'fade' },             // …what slide 1 authored
  ]);

  const slides = transitions.map((t) => ({ shapes: [], media: [], ...(t ? { transition: t } : {}) })) as PptxSlide[];
  const parts = buildPptxParts(slides, { emuW: emuOf(1280), emuH: emuOf(720) });
  const xml = (n: number): string => parts[`ppt/slides/slide${n}.xml`] as string;
  assert.ok(!xml(1).includes('<p:transition'), 'the opening slide is arrived at, not transitioned onto');
  assert.match(xml(2), /<p:transition spd="med"><p:push dir="l"\/><\/p:transition>/);
  assert.match(xml(3), /<p:transition spd="med"><p:fade\/><\/p:transition>/);
  // CT_Slide's child order: the transition sits between clrMapOvr and timing.
  assert.match(xml(2), /<\/p:clrMapOvr><p:transition[\s\S]*<\/p:sld>$/);
});

test('a deck of cuts is byte-identical to a deck that never had transitions', async () => {
  const boxes = (extra: Record<string, unknown>) => ([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', ...extra },
    { id: 'f2', kind: 'frame', x: 1360, y: 0, w: 1280, h: 720, order: 1, bg: '#0b1220', ...extra },
  ]);
  const cuts = deckOf(await mount(boxes({ slideTransition: 'none' })));
  assert.deepEqual(cuts.slides.map((s: any) => s.transition), ['none', 'none'],
    'Cut is authored, not absent - the deck says so');
  assert.deepEqual(deckSlideTransitions(cuts.slides), [undefined, undefined], 'and it lowers to nothing');

  const now = '2026-09-03T00:00:00.000Z';
  const bare = [{ shapes: [], media: [] }, { shapes: [], media: [] }] as PptxSlide[];
  const withCuts = deckSlideTransitions(cuts.slides)
    .map((t) => ({ shapes: [], media: [], ...(t ? { transition: t } : {}) })) as PptxSlide[];
  const opts = { emuW: emuOf(1280), emuH: emuOf(720), now };
  assert.deepEqual(buildPptxParts(withCuts, opts), buildPptxParts(bare, opts),
    'every part of a cuts-only deck matches the deck this builder wrote before transitions existed');
});

test('what PowerPoint cannot animate is named at warn level, not swallowed', async () => {
  // Four things the deck model carries ONLY so the export can say they were left
  // behind: a keyframe track, a hold effect, a morph match key, and a frame state.
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', state: 'dark' },
    { id: 'k', kind: 'box', frame: 'f1', x: 40, y: 40, w: 200, h: 200, shape: 'rect', bg: '#30ba78', kf: 't0_z0*t1500_z140' },
    { id: 'h', kind: 'box', frame: 'f1', x: 300, y: 40, w: 200, h: 200, shape: 'rect', bg: '#30ba78', hold: 'pulse' },
    { id: 'm', kind: 'box', frame: 'f1', x: 560, y: 40, w: 200, h: 200, shape: 'rect', bg: '#30ba78', matchOf: 'hero' },
    { id: 's', kind: 'text', frame: 'f1', x: 40, y: 300, w: 600, h: 120, text: 'By the line', fontSize: 48, enter: 'fade', split: 'line' },
  ]);
  const deck = deckOf(html);
  const notes: DeckNotes = { mapped: [], dropped: [] };
  for (const el of deck.slides[0].elements) deckSyncShape(el, notes);

  const has = (frag: string): boolean => notes.dropped.some((n) => n.includes(frag));
  assert.ok(has('keyframe track'), `keyframes are named: ${notes.dropped}`);
  assert.ok(has('hold effect pulse'), `the hold effect is named: ${notes.dropped}`);
  assert.ok(has('morph match key'), `the match key is named: ${notes.dropped}`);
  assert.ok(has('frame state'), `the frame state is named: ${notes.dropped}`);
  assert.ok(has('split by line'), `the split unit is named: ${notes.dropped}`);
  // A caller that wants one flat list still gets everything - how this parameter was
  // first written, kept working so nobody has to know about the two levels to use it.
  const flat: string[] = [];
  deckSyncShape(deck.slides[0].elements[0], flat);
  assert.ok(flat.some((n) => n.includes('keyframe track')), `${flat}`);
});

/* ── plan 274 work package 6: a Design document with slide-master bindings ────
 *
 * The rows a bound Design frame is made of come from the engine's own seeding
 * (`seedFrame`), so the numbers under test are the numbers Design draws. The
 * lowering under test is packages/node-shell/src/design-pptx.ts, and the OOXML
 * under test is the engine's own `buildPptxParts`, read back with `readPptx`.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { seedFrame } from '../engine/src/slide-master.ts';
import { readPptx } from '../engine/src/pptx-read.ts';
import { designFramesToPptx, framesOfDesignDoc, hasMasterBindings, parseDesignDoc, transitionsOfDeckModel } from '../packages/node-shell/src/design-pptx.ts';
import type { DesignBoxRowV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';

const MASTER_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'masters.json');
const master: SlideMasterV1 = (JSON.parse(readFileSync(MASTER_FILE, 'utf8')) as SlideMasterFileV1).masters[0]!;

// The starter brand's own semantic colours, as a token callback. Real values, so a
// fill that names `color.semantic.text` and a fill that states the same hex both
// land on the same theme slot - which is the mapping this work package is about.
const TOKENS: Record<string, string> = {
  'color.semantic.text': '#11141f',
  'color.semantic.surface': '#ffffff',
  'color.semantic.muted': '#6b7280',
  'color.semantic.primary': '#30ba78',
};
const tokens = (path: string): string | undefined => TOKENS[path];

/** Two seeded frames side by side: a title slide and a content slide. */
function seededDeck(): Array<{ row: DesignBoxRowV1; layers: DesignBoxRowV1[] }> {
  const a = seedFrame(master, 'title', { frameId: 'f1', x: 0, y: 0, resolveToken: tokens });
  const b = seedFrame(master, 'content', { frameId: 'f2', x: 1400, y: 0, resolveToken: tokens });
  assert.ok(a && b, 'the starter master ships the title and content archetypes');
  a!.frame.order = 0;
  b!.frame.order = 1;
  return [{ row: a!.frame, layers: a!.layers }, { row: b!.frame, layers: b!.layers }];
}

/** Put words in the role-bound layers, so the slides are not empty. */
function withText(frames: ReturnType<typeof seededDeck>, texts: Record<string, string>): typeof frames {
  for (const f of frames) {
    for (const layer of f.layers) {
      const role = typeof layer.role === 'string' ? layer.role : '';
      if (role && texts[role] != null && layer.kind === 'text') layer.text = texts[role]!;
    }
  }
  return frames;
}

const xmlOf = (parts: Record<string, string | Uint8Array>, path: string): string => {
  const v = parts[path];
  assert.ok(typeof v === 'string', `${path} is in the package`);
  return v as string;
};

test('274 WP6: a bound deck emits one slideLayout per archetype, each with placeholders', async () => {
  const frames = withText(seededDeck(), { title: 'Renovate', subtitle: 'A deck, on brand', body: 'One point' });
  const out = await designFramesToPptx({ frames, master, tokens });

  assert.equal(out.slides.length, 2, 'one slide per frame');
  assert.equal(out.layouts.length, 2, 'the title and content archetypes each become a layout');
  assert.deepEqual(out.layoutOfArchetype.map((e) => e.archetype), ['title', 'content']);
  assert.deepEqual(out.slides.map((s) => s.layout), [0, 1], 'each slide binds to its own layout');
  for (const layout of out.layouts) {
    assert.ok((layout.placeholders ?? []).length > 0, `${layout.name} carries placeholders`);
  }

  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h),
    theme: out.theme, layouts: out.layouts, now: '2026-09-23T00:00:00.000Z',
  });
  assert.ok(parts['ppt/slideLayouts/slideLayout1.xml'], 'slideLayout1.xml is written');
  assert.ok(parts['ppt/slideLayouts/slideLayout2.xml'], 'slideLayout2.xml is written');
  assert.match(xmlOf(parts, 'ppt/slideLayouts/slideLayout1.xml'), /<p:ph type="title"/,
    'the title layout declares a title placeholder');
});

test('274 WP6: role-bound text carries the placeholder binding onto the slide', async () => {
  const frames = withText(seededDeck(), { title: 'Renovate', subtitle: 'A deck, on brand' });
  const out = await designFramesToPptx({ frames, master, tokens });

  const titleShape = out.slides[0]!.shapes.find((s) => s.kind === 'text' && s.ph?.type === 'title');
  assert.ok(titleShape, 'the title layer bound to the title placeholder');
  assert.equal((titleShape as { paras: Array<{ runs: Array<{ text: string }> }> }).paras[0]!.runs[0]!.text, 'Renovate');

  const subtitle = out.slides[0]!.shapes.find((s) => s.kind === 'text' && s.ph?.type === 'subTitle');
  assert.ok(subtitle, 'the subtitle layer bound to a subTitle placeholder');
  assert.ok(typeof (subtitle as { ph?: { idx?: number } }).ph?.idx === 'number', 'and it carries an idx');

  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h),
    theme: out.theme, layouts: out.layouts, now: '2026-09-23T00:00:00.000Z',
  });
  assert.match(xmlOf(parts, 'ppt/slides/slide1.xml'), /<p:ph type="title"\/>/,
    'the slide text is placeholder-bound, which is what Outline view and Reset Slide read');
});

test('274 WP6: a token-mapped fill reports its theme slot; a literal fill stays literal', async () => {
  const frames = seededDeck();
  // One box painted by token path, one painted with a hex nothing in the theme claims.
  frames[1]!.layers.push({ id: 'tokened', kind: 'box', frame: 'f2', x: 1400, y: 40, w: 200, h: 100, order: 90, bg: 'color.semantic.primary' });
  frames[1]!.layers.push({ id: 'literal', kind: 'box', frame: 'f2', x: 1700, y: 40, w: 200, h: 100, order: 91, bg: '#c0ffee' });
  const out = await designFramesToPptx({ frames, master, tokens });

  const tokened = out.schemeRefs.find((r) => r.layerId === 'tokened');
  assert.ok(tokened, 'the token-painted box reports a theme slot');
  assert.equal(tokened!.slot, 'accent1');
  assert.equal(tokened!.via, 'token');
  assert.equal(tokened!.hex, '30BA78');
  assert.ok(!out.schemeRefs.some((r) => r.layerId === 'literal'), 'the literal box claims no slot');

  // The theme part carries the slot values, so a rebrand in PowerPoint moves the theme.
  assert.equal(out.theme?.colors?.accent1, '30BA78');
  assert.equal(out.theme?.colors?.dk1, '11141F');

  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h),
    theme: out.theme, layouts: out.layouts, now: '2026-09-23T00:00:00.000Z',
  });
  assert.match(xmlOf(parts, 'ppt/theme/theme1.xml'), /<a:accent1><a:srgbClr val="30BA78"\/><\/a:accent1>/);
  // KNOWN LIMIT: the engine's PptxFill has no scheme reference, so BOTH fills are
  // written as srgbClr today and the slot travels in `schemeRefs` instead. When
  // `{ scheme }` is added to PptxFill this assertion is the one that changes.
  assert.match(xmlOf(parts, 'ppt/slides/slide2.xml'), /<a:srgbClr val="C0FFEE"\/>/,
    'the literal fill is literal');
  assert.match(xmlOf(parts, 'ppt/slides/slide2.xml'), /<a:srgbClr val="30BA78"\/>/,
    'and the token fill is still written with the token value');
});

test('274 WP6: notes reach the notes part, and the deck reads back with its placeholders', async () => {
  const frames = withText(seededDeck(), { title: 'Renovate', body: 'One point' });
  frames[0]!.row.notes = 'Say the thing about the old deck.';
  const out = await designFramesToPptx({ frames, master, tokens });
  assert.equal(out.slides[0]!.notes, 'Say the thing about the old deck.');

  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h),
    theme: out.theme, layouts: out.layouts, now: '2026-09-23T00:00:00.000Z',
  });
  const notes = Object.keys(parts).filter((p) => p.startsWith('ppt/notesSlides/'));
  assert.ok(notes.length >= 1, `a notesSlide part was written: ${Object.keys(parts).join(', ')}`);
  assert.match(xmlOf(parts, 'ppt/notesSlides/notesSlide1.xml'), /Say the thing about the old deck\./);

  // Read it back with Lolly's own reader. This is a check, never the proof - the
  // proof is that another consumer opens it, which the LibreOffice case below does
  // where soffice is installed.
  const win = new JSDOM('').window;
  const parseXml = (xml: string): Document =>
    new win.DOMParser().parseFromString(xml, 'application/xml') as unknown as Document;
  const deck = readPptx(parts as Record<string, string>, parseXml);
  assert.equal(deck.slides.length, 2);
  const bound = deck.slides[0]!.nodes.filter((n) => !!(n as { ph?: unknown }).ph);
  assert.ok(bound.length >= 1, `the reader resolves the placeholder binding back: ${JSON.stringify(deck.slides[0]!.nodes.map((n) => Object.keys(n)))}`);
});

test('274 WP6: parseDesignDoc reads the document script Design already emits', async () => {
  const html = await mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', master: master.id, archetype: 'title' },
    { id: 't', kind: 'text', frame: 'f1', x: 60, y: 200, w: 900, h: 200, text: 'Bound', fontSize: 64, role: 'title', master: master.id },
  ]);
  const doc = new JSDOM(html).window.document;
  const parsed = parseDesignDoc(doc.querySelector('[data-penpot-doc]')?.textContent);
  assert.ok(parsed, 'the document script parses');
  assert.equal(hasMasterBindings(parsed!), true, 'the frame binding survives the render');
  const frames = framesOfDesignDoc(parsed!);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.layers.length, 1, 'the member layer is grouped under its frame');

  const out = await designFramesToPptx({ frames, master, tokens });
  assert.ok(out.slides[0]!.shapes.some((s) => s.kind === 'text' && s.ph?.type === 'title'),
    'and it lowers to placeholder-bound text straight off the render');
});

/* ── the independent consumer, where one is installed ─────────────────────────
 * LibreOffice is the check that this is a deck someone else can open, not only a
 * deck Lolly can read. It is not a dependency of this repository, so the case
 * skips by name where soffice is absent (the identity is in tests/expected-skips.json).
 */
function sofficeOnPath(): string | null {
  for (const bin of ['soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 30_000 });
      return bin;
    } catch { /* not this one */ }
  }
  return null;
}

// The reason string is quoted byte for byte in tests/expected-skips.json, and the word
// "binary" is what `capabilityFor` reads as external-tool. Both halves have to match or
// check:skip-identities fails on every machine without LibreOffice.
const SOFFICE_SKIP = 'the soffice binary is not on PATH, so no independent consumer can open the deck here';

test('274 WP6: LibreOffice converts the bound deck to a PDF', { skip: sofficeOnPath() ? false : SOFFICE_SKIP }, async () => {
  const bin = sofficeOnPath()!;
  const frames = withText(seededDeck(), { title: 'Renovate', subtitle: 'On brand', body: 'One point' });
  const out = await designFramesToPptx({ frames, master, tokens });
  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h),
    theme: out.theme, layouts: out.layouts, now: '2026-09-23T00:00:00.000Z',
  });
  const { zipSync } = await import('fflate');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(parts)) files[path] = typeof content === 'string' ? enc.encode(content) : content;

  const dir = mkdtempSync(join(tmpdir(), 'lolly-wp6-'));
  const pptx = join(dir, 'deck.pptx');
  writeFileSync(pptx, zipSync(files));
  execFileSync(bin, ['--headless', '--convert-to', 'pdf', '--outdir', dir, pptx], { stdio: 'ignore', timeout: 180_000 });
  const pdf = readFileSync(join(dir, 'deck.pdf'));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-', 'LibreOffice wrote a PDF from it');
});

test('274 WP6: the CLI writes a native .pptx for a Design document with no browser', async () => {
  const bx = JSON.stringify([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', master: master.id, archetype: 'title', notes: 'Say the thing.' },
    { id: 't1', kind: 'text', frame: 'f1', x: 60, y: 200, w: 900, h: 200, text: 'Renovate', fontSize: 64, role: 'title', master: master.id, order: 1 },
    { id: 'f2', kind: 'frame', x: 1400, y: 0, w: 1280, h: 720, order: 1, bg: '#ffffff', master: master.id, archetype: 'content' },
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'lolly-wp6-cli-'));
  const out = join(dir, 'deck.pptx');
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  execFileSync(process.execPath, [join(repo, 'shells', 'cli', 'bin', 'lolly.ts'), 'design', '--export=pptx', `--bx=${bx}`, `--output=${out}`], {
    cwd: repo,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start' },
    stdio: 'ignore',
    timeout: 120_000,
  });
  const bytes = readFileSync(out);
  assert.equal(bytes.subarray(0, 2).toString('latin1'), 'PK', 'a zip container came out');

  // Tier A means the layouts and the placeholder binding are in the file the CLI
  // wrote, not only in the file a browser would have written.
  const { unzipSync } = await import('fflate');
  const entries = unzipSync(new Uint8Array(bytes));
  assert.ok(entries['ppt/slideLayouts/slideLayout1.xml'], `slideLayout1.xml is in the package: ${Object.keys(entries).join(', ')}`);
  const slide1 = new TextDecoder().decode(entries['ppt/slides/slide1.xml']!);
  assert.match(slide1, /<p:ph type="title"\/>/, 'the CLI deck carries the placeholder binding');
  assert.ok(entries['ppt/notesSlides/notesSlide1.xml'], 'and the frame notes reached the notes part');
});

/* ── the guards, and what they must NOT catch ─────────────────────────────────
 * `inexpressible` mirrors community/design/hooks.js `deckInexpressible`. The two
 * directions are both bugs: a guard that misses lets a tilted or mirrored layer out
 * flat, and a guard that over-fires deletes an ordinary layer from the deck.
 */

/** One unbound frame carrying the given layers, ready for designFramesToPptx. */
function plainFrame(layers: DesignBoxRowV1[]): Array<{ row: DesignBoxRowV1; layers: DesignBoxRowV1[] }> {
  return [{ row: { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0 }, layers }];
}

test('274 WP6: a Shadow or Blend control set back to its OFF value still exports', async () => {
  // Both controls write their "off" option verbatim into the row, so a layer someone
  // opened the Shadow menu on carries shadow:'none'. Reading that as a shadow dropped
  // the layer from the deck entirely.
  const frames = plainFrame([
    { id: 'a', kind: 'box', frame: 'f1', x: 0, y: 0, w: 100, h: 100, bg: '#30ba78', shadow: 'none', blend: 'normal' },
    { id: 'b', kind: 'box', frame: 'f1', x: 200, y: 0, w: 100, h: 100, bg: '#30ba78', blend: 'multiply' },
    { id: 'c', kind: 'box', frame: 'f1', x: 400, y: 0, w: 100, h: 100, bg: '#30ba78', shadow: 'box' },
  ]);
  const out = await designFramesToPptx({ frames, tokens });
  const rects = out.slides[0]!.shapes.filter((s) => s.kind === 'rect');
  assert.equal(rects.length, 1, `only the real blend and the real shadow are left out: ${JSON.stringify(out.notes)}`);
  assert.ok(out.notes.some((n) => n.startsWith('a blend mode')), `the real blend is named: ${out.notes}`);
  assert.ok(out.notes.some((n) => n.startsWith('a shadow')), `the real shadow is named: ${out.notes}`);
});

test('274 WP6: a mirror, a tilt and a clip mask are left out rather than drawn flat', async () => {
  const frames = plainFrame([
    // '1' is how a block boolean comes back from a share link or a ?z= document. A mirrored
    // box is the same rectangle and lowers; mirrored text cannot be written and is left out.
    { id: 'flip', kind: 'text', frame: 'f1', x: 0, y: 0, w: 100, h: 100, text: 'Mirror', flipH: '1' },
    { id: 'tilt', kind: 'box', frame: 'f1', x: 200, y: 0, w: 100, h: 100, bg: '#30ba78', rx: 12 },
    { id: 'tilty', kind: 'box', frame: 'f1', x: 400, y: 0, w: 100, h: 100, bg: '#30ba78', ry: 12 },
    { id: 'mask', kind: 'box', frame: 'f1', x: 600, y: 0, w: 100, h: 100, bg: '#30ba78', clip: 'shape' },
    { id: 'shape', kind: 'box', frame: 'f1', x: 600, y: 0, w: 100, h: 100, bg: '#ffffff' },
  ]);
  const out = await designFramesToPptx({ frames, tokens });
  const rects = out.slides[0]!.shapes.filter((s) => s.kind === 'rect');
  assert.equal(rects.length, 1, `only the clip SOURCE is drawn: ${JSON.stringify(out.notes)}`);
  assert.ok(out.notes.some((n) => n.startsWith('a flipped object')), `the mirror is named: ${out.notes}`);
  assert.ok(out.notes.some((n) => n.startsWith('a perspective tilt')), `the tilt is named: ${out.notes}`);
  assert.ok(out.notes.some((n) => n.startsWith('a clip mask')), `the mask is named: ${out.notes}`);
});

test('274 WP6: text with nothing stated carries Design\'s own colour and weight', async () => {
  const frames = plainFrame([
    { id: 't', kind: 'text', frame: 'f1', x: 40, y: 40, w: 600, h: 120, text: 'Bold?', fontSize: 40 },
  ]);
  const out = await designFramesToPptx({ frames, tokens });
  const text = out.slides[0]!.shapes.find((s) => s.kind === 'text');
  assert.ok(text, 'the text layer reached the slide');
  const run = (text as { paras: Array<{ runs: Array<{ color?: string; bold?: boolean }> }> }).paras[0]!.runs[0]!;
  assert.equal(run.color, '11141F', 'the run carries the colour Design paints, not whatever the theme supplies');
  assert.equal(run.bold, true, 'and an absent weight is 700, which is what the canvas shows');
});

test('274 WP6: a colour written as a CSS variable takes the brand value', async () => {
  const frames = plainFrame([
    { id: 'a', kind: 'box', frame: 'f1', x: 0, y: 0, w: 100, h: 100, bg: 'var(--brand-primary, #1e293b)' },
  ]);
  const bare = await designFramesToPptx({ frames, tokens });
  assert.equal((bare.slides[0]!.shapes[0] as { fill?: { solid?: string } }).fill?.solid, '1E293B',
    'with no resolver the literal inside the var() is all there is');

  const cssVars = (name: string): string => (name === '--brand-primary' ? '#30ba78' : '');
  const branded = await designFramesToPptx({ frames, tokens, cssVars });
  assert.equal((branded.slides[0]!.shapes[0] as { fill?: { solid?: string } }).fill?.solid, '30BA78',
    'with the canvas custom properties it is the brand colour');
});

test('274 WP6: role ordinals are counted in document order, as applyArchetype counts them', async () => {
  // Two body layers whose PAINT order is the reverse of their document order. The
  // first body placeholder must still take the first body layer in the document, or
  // Reset Slide in PowerPoint would move content to a different box than Design does.
  const seeded = seedFrame(master, 'content', { frameId: 'f1', x: 0, y: 0, resolveToken: tokens });
  assert.ok(seeded, 'the starter master ships a content archetype');
  const layers = seeded!.layers.filter((l) => l.kind === 'text');
  const body = layers.find((l) => l.role === 'body');
  assert.ok(body, 'the content archetype has a body placeholder');
  const second: DesignBoxRowV1 = { ...body!, id: 'body-2', text: 'second in the document', order: 0 };
  body!.text = 'first in the document';
  body!.order = 9;
  const frames = [{ row: seeded!.frame, layers: [...seeded!.layers, second] }];

  const out = await designFramesToPptx({ frames, master, tokens });
  const texts = out.slides[0]!.shapes.filter((s) => s.kind === 'text') as Array<{
    ph?: { idx?: number }; paras: Array<{ runs: Array<{ text: string }> }>;
  }>;
  const first = texts.find((t) => t.paras[0]?.runs[0]?.text === 'first in the document');
  const other = texts.find((t) => t.paras[0]?.runs[0]?.text === 'second in the document');
  assert.ok(first?.ph, 'the first body layer in the document is placeholder-bound');
  assert.ok(!other?.ph || other.ph.idx !== first!.ph!.idx,
    'and the second one did not take the same placeholder');
});

test('274 WP6: a frame naming a second slide master is reported, not silently flattened', async () => {
  const frames = seededDeck();
  frames[1]!.row.master = 'some-other-master';
  frames[1]!.row.archetype = 'content';
  const out = await designFramesToPptx({ frames, master, tokens });
  assert.equal(out.layouts.length, 1, 'only the loaded master builds a layout');
  assert.ok(out.notes.some((n) => n.includes('some-other-master')), `the other master is named: ${out.notes}`);
});

test('274 WP6: a transition set once for the whole document still reaches the slides', async () => {
  // The document-level transition is an INPUT, so it is not in the rows the native
  // lowering reads. Design resolves it per slide into its own deck model, and both
  // shells hand that list over - without it a deck authored this way arrived with cuts.
  const boxes = [
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', master: master.id, archetype: 'title' },
    { id: 'f2', kind: 'frame', x: 1400, y: 0, w: 1280, h: 720, order: 1, bg: '#ffffff', master: master.id, archetype: 'content' },
  ];
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never, transition: 'fade' as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const dom = new JSDOM(rt.getHydrated() as string).window.document;

  const resolved = transitionsOfDeckModel(dom.querySelector('[data-pptx-deck]')?.textContent);
  assert.deepEqual(resolved, ['fade', 'fade'], 'the tool resolved the document value onto each slide');

  const doc = parseDesignDoc(dom.querySelector('[data-penpot-doc]')?.textContent);
  assert.ok(doc, 'the document script is there');
  const frames = framesOfDesignDoc(doc!);

  const without = await designFramesToPptx({ frames, master, tokens });
  assert.equal(without.slides[1]!.transition, undefined, 'the rows alone state nothing');

  const out = await designFramesToPptx({ frames, master, tokens, slideTransitions: resolved! });
  assert.ok(out.slides[1]!.transition, 'and with the resolved list slide 2 arrives on a transition');
});

test('274 WP6: motion is named as left out rather than arriving static and unreported', async () => {
  const frames = plainFrame([
    { id: 'a', kind: 'text', frame: 'f1', x: 0, y: 0, w: 400, h: 100, text: 'In', fontSize: 40, enter: 'fade' },
  ]);
  const out = await designFramesToPptx({ frames, tokens });
  assert.ok(out.slides[0]!.shapes.some((s) => s.kind === 'text'), 'the text still exports');
  assert.ok(out.notes.some((n) => n.startsWith('an animation was left out')), `and the motion is named: ${out.notes}`);
});

// ── plan 275 section 7.2: Design text lowers to paragraphs and styled runs ────

test('plan 275: a bound body in Design text writes b, i, u, strike, buChar, buAutoNum, lvl and algn', async () => {
  const frames = seededDeck();
  const body = frames[1]!.layers.find((layer) => layer.role === 'body');
  assert.ok(body, 'the content archetype seeds a body layer');
  body!.text = '- **Bold** and *italic*\n  - {u|under} and {s|struck}\n1. first\n2. {#c00000|red}\nplain close';
  body!.align = 'center';
  const out = await designFramesToPptx({ frames, master, tokens });
  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), theme: out.theme, layouts: out.layouts, now: '2026-09-24T00:00:00.000Z' });
  const xml = xmlOf(parts, 'ppt/slides/slide2.xml');
  assert.doesNotMatch(xml, /<a:t>[^<]*(\*\*|\{u\||\{s\||^- )/, 'no marker is written as text');
  assert.match(xml, /b="1"[^>]*>(?:(?!<\/a:r>).)*<a:t>Bold<\/a:t>/s, 'bold');
  assert.match(xml, /i="1"[^>]*>(?:(?!<\/a:r>).)*<a:t>italic<\/a:t>/s, 'italic');
  assert.match(xml, /u="sng"[^>]*>(?:(?!<\/a:r>).)*<a:t>under<\/a:t>/s, 'underline');
  assert.match(xml, /strike="sngStrike"[^>]*>(?:(?!<\/a:r>).)*<a:t>struck<\/a:t>/s, 'strike');
  assert.match(xml, /<a:buChar char="•"\/>/, 'a bullet');
  assert.match(xml, /<a:buAutoNum type="arabicPeriod"\/>/, 'a number');
  assert.match(xml, /lvl="1"/, 'the nested bullet keeps its level');
  assert.match(xml, /algn="ctr"/, 'the box alignment on every paragraph');
  assert.match(xml, /<a:buNone\/>(?:(?!<\/a:p>).)*<a:t>plain close<\/a:t>/s, 'a plain line in a list is not a list item');
  assert.match(xml, /C00000/i, 'the run colour travels');
  // Plain text with no markup still lowers as it always did: one run per line.
  const plain = seededDeck();
  const plainBody = plain[1]!.layers.find((layer) => layer.role === 'body');
  plainBody!.text = 'one line\nanother line';
  const plainOut = await designFramesToPptx({ frames: plain, master, tokens });
  const shape = plainOut.slides[1]!.shapes.find((s) => s.kind === 'text' && s.ph?.type === 'body') as { paras: Array<{ runs: unknown[]; bullet?: unknown }> };
  assert.deepEqual(shape.paras.map((p) => [p.runs.length, p.bullet]), [[1, undefined], [1, undefined]]);
});

test('plan 275: the tool deck model lowers Design text line by line, and plain text as one run', async () => {
  const deck = deckOf(await mount([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff' },
    { id: 'rich', kind: 'text', x: 10, y: 10, w: 800, h: 300, fontSize: 32, weight: '400', frame: 'fa', text: '**B** *i*\n- item\n  1. deep' },
    { id: 'flat', kind: 'text', x: 10, y: 400, w: 800, h: 100, fontSize: 32, weight: '700', frame: 'fa', text: 'Plain\nlines' },
  ]));
  const [rich, flat] = deck.slides[0].elements;
  assert.deepEqual(rich.paras.map((p: any) => [p.bullet, p.level, p.runs.map((r: any) => [r.text, !!r.bold, !!r.italic])]), [
    [false, undefined, [['B', true, false], [' ', false, false], ['i', false, true]]],
    [true, undefined, [['item', false, false]]],
    ['number', 1, [['deep', false, false]]],
  ]);
  assert.deepEqual(flat.paras, [{ align: 'ctr', runs: [{ text: 'Plain\nlines', sizePt: 24, color: '#11141f', bold: true }] }], 'plain text is the one run it always was');
});

// ─── plan 275 decision 32: a round trip keeps drawings as shapes ─────────────

test('275: a compiled chart lowers to native shapes, custom geometry and all, with its partial opacity', async () => {
  const { createHash } = await import('node:crypto');
  const { inflatePptx } = await import('../packages/node-shell/src/pptx.ts');
  const { sourceDeckFromPptx } = await import('../packages/node-shell/src/rebrand/source-pptx.ts');
  const { compileFaithful } = await import('../engine/src/deck-compile.ts');
  const bytes = new Uint8Array(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'rebrand', 'vector.pptx')));
  const parser = new (new JSDOM('').window.DOMParser)();
  const deck = await sourceDeckFromPptx(await inflatePptx(bytes), (xml) => parser.parseFromString(xml, 'application/xml'), {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, instanceId: 'rt', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b, _m, hint) => `user/media/${hint.slice(0, 16)}`,
  });
  const compiled = compileFaithful(deck);
  const first = compiled.frames[0]!;
  const frames = [{ row: first.layers[0]!, layers: first.layers.slice(1) }];
  const out = await designFramesToPptx({ frames });
  const pathRows = first.layers.filter((row) => row.kind === 'path');
  const boxRows = first.layers.filter((row) => row.kind === 'box');
  assert.equal(out.notes.some((n) => /pen path/.test(n)), false, 'no path is left out');
  assert.equal(out.notes.some((n) => /partial opacity/.test(n)), false, 'a translucent gridline is not left out');

  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), now: '2026-09-24T00:00:00.000Z' });
  const back = readPptx(parts, (xml) => parser.parseFromString(xml, 'application/xml'));
  const shapes = back.slides[0]!.nodes.filter((n) => n.type === 'shape');
  const custom = shapes.filter((n) => n.type === 'shape' && n.custGeom);
  assert.equal(custom.length, pathRows.length, 'one custom-geometry shape per path row');
  assert.equal(shapes.length - custom.length, boxRows.length, 'one preset shape per box row, the bars among them');
  assert.equal(back.slides[0]!.nodes.some((n) => n.type === 'pic' && n.svg), false, 'no chart comes back as an SVG picture');
  const fills = (list: Array<{ fill?: { hex?: string } }>): string[] => list.map((n) => (n.fill?.hex ?? '').toLowerCase()).filter(Boolean).sort();
  const rowFills = [...pathRows, ...boxRows].map((row) => String(row.bg ?? '').replace('#', '').slice(0, 6).toLowerCase()).filter(Boolean).sort();
  assert.deepEqual(fills(shapes), rowFills, 'the fills match row for row');
  const gridline = custom.find((n) => n.type === 'shape' && n.line?.hex === '999999');
  assert.equal(gridline?.type === 'shape' ? gridline.line?.alpha : undefined, 0.3, 'the gridline keeps its 30% opacity as line alpha');
  assert.ok(custom.some((n) => n.type === 'shape' && n.fill?.alpha === 0.8), 'a label keeps its 80% opacity as fill alpha');
});

test('275: a path row with no decodable outline, or a multi-colour vector, is left out and named', async () => {
  const layers: DesignBoxRowV1[] = [
    { id: 'a', kind: 'path', x: 0, y: 0, w: 10, h: 10, frame: 'f', path: 'nonsense', bg: '#000000' },
    { id: 'b', kind: 'path', x: 0, y: 0, w: 10, h: 10, frame: 'f', path: '1!cubic!1_0!0_1!1', pathPaint: '{}' },
  ];
  const frames = [{ row: { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720 }, layers }];
  const out = await designFramesToPptx({ frames });
  assert.equal(out.slides[0]!.shapes.length, 0);
  assert.ok(out.notes.some((n) => /outline could not be read/.test(n)));
  assert.ok(out.notes.some((n) => /multi-colour vector/.test(n)));
});

test('275: the tool deck model carries a path box as its outline, its opacity folded into the colours', async () => {
  const { encodeAuthoredPaths } = await import('../engine/src/geom/authored-url.ts');
  const { makeGeomApi } = await import('../engine/src/geom-api.ts');
  const path = encodeAuthoredPaths([{ kind: 'cubic', closed: false, nodes: [{ x: 0.5, y: 0, continuity: 'corner' }, { x: 0.5, y: 1, continuity: 'corner' }] }]);
  // A path box is drawn through host.geom, which every shell provides.
  const mountWithGeom = async (boxes: unknown[]): Promise<string> => {
    const rt = await createRuntime(tool, { ...baseHost(), geom: makeGeomApi() }, { boxes: boxes as never });
    assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
    return rt.getHydrated() as string;
  };
  const html = await mountWithGeom([
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'grid', kind: 'path', x: 100, y: 100, w: 4, h: 300, path, bg: '', stroke: '#999999', strokeW: 2, opacity: 30, frame: 'fa' },
    { id: 'label', kind: 'path', x: 200, y: 100, w: 40, h: 10, path: encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [{ x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 0, continuity: 'corner' }, { x: 1, y: 1, continuity: 'corner' }] }]), bg: '#141414', opacity: 80, frame: 'fa' },
  ]);
  const els = deckOf(html).slides[0].elements;
  assert.equal(els.length, 2, 'neither translucent path is skipped');
  assert.equal(els[0].t, 'path');
  assert.match(els[0].d, /^M/, 'the outline travels as path data in the box');
  assert.deepEqual(els[0].line, { color: '#9999994d', w: 2 }, '30% opacity rides on the line colour');
  assert.equal(els[0].fill, undefined);
  assert.equal(els[1].fill, '#141414cc', '80% opacity rides on the fill');
});

test('275: a translucent text box and a translucent outlined box fold alike in both lowerings', async () => {
  const layers: DesignBoxRowV1[] = [
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'label', kind: 'text', x: 10, y: 10, w: 300, h: 40, text: 'Share', fontSize: 20, fg: '#141414', opacity: 50, frame: 'fa' },
    { id: 'bar', kind: 'box', x: 10, y: 100, w: 200, h: 40, shape: 'rect', bg: '#30ba78', stroke: '#0c322c', strokeW: 2, opacity: 50, frame: 'fa' },
  ];
  // The web lowering: the tool's deck model through the shared element lowering.
  const els = deckOf(await mount(layers)).slides[0].elements;
  assert.equal(els.length, 2, 'the web lowering keeps both');
  const webShapes = els.map((el: Record<string, unknown>) => deckSyncShape(el));
  const webText = webShapes.find((s: { kind: string } | null) => s?.kind === 'text');
  const webRect = webShapes.find((s: { kind: string } | null) => s?.kind === 'rect');
  // The node lowering the CLI and MCP use.
  const out = await designFramesToPptx({ frames: plainFrame(layers.slice(1)) });
  const nodeText = out.slides[0]!.shapes.find((s) => s.kind === 'text');
  const nodeRect = out.slides[0]!.shapes.find((s) => s.kind === 'rect');
  assert.ok(nodeText && nodeRect, `the node lowering keeps both: ${JSON.stringify(out.notes)}`);
  const alphaOf = (s: unknown): number | undefined => (s as { paras: Array<{ runs: Array<{ alpha?: number }> }> }).paras[0]!.runs[0]!.alpha;
  assert.equal(alphaOf(nodeText), 0.5, 'node: the run carries the opacity');
  assert.ok(Math.abs((alphaOf(webText) ?? 1) - 0.5) < 0.01, `web: the run carries the opacity (${alphaOf(webText)})`);
  const lineAlpha = (s: unknown): number | undefined => (s as { line?: { alpha?: number } }).line?.alpha;
  assert.equal(lineAlpha(nodeRect), 0.5, 'node: the outline carries the opacity');
  assert.ok(Math.abs((lineAlpha(webRect) ?? 1) - 0.5) < 0.01, `web: the outline carries the opacity (${lineAlpha(webRect)})`);
});

test('275: a circle marker from a drawing comes back from a round trip as custom geometry, not a square', async () => {
  const { svgItemsOf, vectorItemsToRows } = await import('../engine/src/svg-items.ts');
  const parser = new (new JSDOM('').window.DOMParser)();
  const items = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#d65a28"/></svg>', (xml) => parser.parseFromString(xml, 'image/svg+xml'));
  const made = vectorItemsToRows(items, { x: 100, y: 100, w: 400, h: 400 }, { idPrefix: 'c', group: 'vector:c', frame: 'f', fit: 'fill' });
  assert.ok('rows' in made);
  assert.equal(made.rows[0]!.kind, 'path', 'a circle is a path row');
  const out = await designFramesToPptx({ frames: [{ row: { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720 }, layers: made.rows }] });
  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), now: '2026-09-24T00:00:00.000Z' });
  const back = readPptx(parts, (xml) => parser.parseFromString(xml, 'application/xml'));
  const shape = back.slides[0]!.nodes.find((n) => n.type === 'shape');
  assert.ok(shape?.type === 'shape' && shape.custGeom, 'the marker is custom geometry');
  const path = shape.custGeom.paths[0]!;
  assert.match(path.d, /C/, 'its outline is curved');
  // The outline spans its own box: a coordinate written short (1524000 as 1524) would not.
  const xs = [...path.d.matchAll(/[MC]([\d.]+) /g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...xs) > path.w * 0.99, `the outline reaches the right edge of its space (${Math.max(...xs)} of ${path.w})`);
});

test('275: a turned and a mirrored chart keep every row in a round trip', async () => {
  const { svgItemsOf, vectorItemsToRows } = await import('../engine/src/svg-items.ts');
  const parser = new (new JSDOM('').window.DOMParser)();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="30" height="80" fill="#1f4e79"/>'
    + '<path d="M60 90L90 10L90 90Z" fill="#d65a28"/></svg>';
  const items = svgItemsOf(svg, (xml) => parser.parseFromString(xml, 'image/svg+xml'));
  const turned = vectorItemsToRows(items, { x: 100, y: 100, w: 200, h: 200, rot: 30 }, { idPrefix: 't', group: 'vector:t', frame: 'f', fit: 'fill' });
  const mirrored = vectorItemsToRows(items, { x: 400, y: 100, w: 200, h: 200, flipH: true }, { idPrefix: 'm', group: 'vector:m', frame: 'f', fit: 'fill' });
  assert.ok('rows' in turned && 'rows' in mirrored);
  const out = await designFramesToPptx({ frames: [{ row: { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720 }, layers: [...turned.rows, ...mirrored.rows] }] });
  assert.equal(out.slides[0]!.shapes.length, 4, `no row is left out: ${JSON.stringify(out.notes)}`);
  const [bar, tri, mbar, mtri] = out.slides[0]!.shapes as Array<{ kind: string; cx: number; rot?: number; paths?: Array<{ d: string }> }>;
  assert.equal(bar!.rot, 30);
  assert.equal(tri!.rot, 30, 'every row of the turned chart takes its turn');
  assert.equal(mbar!.rot, undefined);
  assert.equal(mbar!.kind, 'rect', 'a mirrored bar is the same rectangle');
  // The triangle starts at the left of its own box; mirrored, it starts at the right.
  const start = (d: string): number => Number(/^M(-?[\d.]+) /.exec(d)?.[1]);
  const plain = start(tri!.paths![0]!.d);
  const flipped = start(mtri!.paths![0]!.d);
  assert.equal(plain, 0);
  assert.equal(flipped, mtri!.cx, `the mirror is written into the outline (${plain} then ${flipped})`);
});

test('275: a dashed outline is drawn solid and the notes say so, in both lowerings', async () => {
  const layers: DesignBoxRowV1[] = [
    { id: 'grid', kind: 'box', x: 10, y: 10, w: 300, h: 40, shape: 'rect', bg: '', stroke: '#999999', strokeW: 1, strokeDash: 'dashed', frame: 'f' },
  ];
  const out = await designFramesToPptx({ frames: plainFrame(layers) });
  assert.equal(out.slides[0]!.shapes.length, 1);
  assert.ok(out.notes.some((n) => /dashed outline/.test(n)), `node: ${JSON.stringify(out.notes)}`);
  const els = deckOf(await mount([{ id: 'fa', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' }, { ...layers[0]!, frame: 'fa' }])).slides[0].elements;
  const notes: DeckNotes = { mapped: [], dropped: [] };
  deckSyncShape(els[0], notes);
  assert.ok(notes.dropped.some((n) => /dashed outline/.test(n)), `web: ${JSON.stringify(notes)}`);
});
