// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel tests.
 *
 * Two layers, both reachable without a browser:
 *
 *   • the PURE viewport model - seconds ↔ pixels at a zoom and a scroll, the
 *     zoom-about-cursor anchor, the rebuild-vs-restyle memo key, snap candidates,
 *     seam detection, the keyboard containment predicate, and the ruler/filmstrip
 *     density heuristics. These are the functions every gesture is built out of, so
 *     a regression here is a whole class of "the clip lands in the wrong place".
 *
 *   • the CONTROLLER against a jsdom stage, driven through real pointer events, to
 *     pin the one invariant the whole editing model rests on: a drag writes the
 *     model EXACTLY ONCE, on pointerup, never per frame.
 *
 * The panel is driven through its real DOM and its real opts. Nothing here asserts
 * on a mock: `commit` is a recorder because it is the module's output, and what is
 * checked is the resulting Box[], not that a function was called.
 *
 * The thumbnail pass is covered at the level jsdom can honestly reach: which BRANCH
 * each clip kind takes (waveform / filmstrip / tiled still / the card's own fill), the
 * classification off the live canvas that chooses it, the tiling arithmetic, and that a
 * gesture aborts a queued pass. The canvas 2D context is a recorder and the bitmaps are
 * fakes, because node has no raster - see the browser checklist below.
 *
 * NOT covered here (browser-only): that the pictures actually LOOK right (a real decode,
 * a real drawImage, a Lottie's live <svg> rasterising, CORS tainting), layout-derived
 * geometry (jsdom reports 0 for every rect, so the tests below stub the two rects the
 * gesture math reads and the two sizes the thumb pass reads), the ResizeObserver refit,
 * the <dialog> junction modal, and anything the sequence clock does with real media.
 *
 * Run directly:  node --test shells/web/src/views/timeline-panel.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
// Type-only, so it costs nothing at runtime and needs no CSS stub.
import type { Box } from './timeline-math.ts';

// timeline-panel.ts imports its own stylesheet (the self-registering lazy-view
// pattern). Node has no idea what a .css module is, so stub it in-thread for the
// duration of this file - Vite is what resolves it for real.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

// `pretendToBeVisual` is what gives jsdom a requestAnimationFrame at all - the panel
// rAF-coalesces its drag painting, and without it every pointermove throws.
const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// Bound, not copied: these are window methods and lose `this` when lifted bare.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;

const {
  timeToPx, pxToTime, clientToTime, clampPxPerSec, fitPxPerSec, zoomAbout,
  tracksKey, snapCandidates, junctionAt, isTextControl, panelKeysActive,
  clampPanelH, tickStep, frameCountFor, packSeqRow, initTimelinePanel,
  isPaintedColor, thumbMode, canRasterBox, appearanceSig,
  MIN_PPS, MAX_PPS, MIN_PANEL_H, ONE_LANE_H, EDGE_PX, EDGE_PX_COARSE, TAKE_TIMING,
  MAX_NODE_RASTERS_PER_PASS, MAX_THUMB_PASSES, PANEL_SHORTCUTS, playOnce, canPlayOnce,
} = await import('./timeline-panel.ts');

// Both views are an orchestrator plus feature modules under a directory of the same name
// (2026-09-09 split), so a source pin reads the whole feature rather than one file.
const featureSrc = (view: string): string => {
  const dir = new URL(`./${view}/`, import.meta.url);
  return [readFileSync(new URL(`./${view}.ts`, import.meta.url), 'utf8'), ...readdirSync(dir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(new URL(n, dir), 'utf8'))].join('\n');
};
// The trim readout's formatters, asserted against the badge the panel paints (the
// numbers themselves are covered in tests/timeline-math.test.ts).
const { fmtDelta, fmtDur } = await import('./timeline-math.ts');
// The SAME module instance the panel holds (a dynamic import of an already-evaluated
// module is the same record), so the seam installed here is the one it calls.
const { _setNodeRasterer, clearClipThumbCache, _setFrameAtImpl } = await import('../lib/clip-thumbs.ts');

/** The phase-1 field mapping, exactly as sequence-studio's manifest declares it. */
const cfg = {
  idField: 'id', startField: 'start', durField: 'dur', clipInField: 'clipIn',
  speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane',
  // OPTIONAL in TimeCfg, declared here because sequence-studio declares them: the
  // inspector offers an easing control only for a tool whose manifest asked for the
  // sub-field, so a cfg without these must not grow one (pinned below).
  enterEaseField: 'enterEase', exitEaseField: 'exitEase',
};

const clip = (id: string, start: number, dur: number): Box => ({ id, start, dur, lane: 'seq' });
const overlay = (id: string, start: number, dur: number): Box => ({ id, start, dur, lane: '' });
const scenery = (id: string): Box => ({ id, start: '', dur: '', lane: '' });

// ── the viewport model (pure) ─────────────────────────────────────────────────

test('timeToPx / pxToTime round-trip at a zoom, and degenerate zoom reads as 0s', () => {
  assert.equal(timeToPx(2.5, 40), 100);
  assert.equal(pxToTime(100, 40), 2.5);
  for (const pps of [4, 40, 137, 600]) {
    assert.ok(Math.abs(pxToTime(timeToPx(3.25, pps), pps) - 3.25) < 1e-9, `round-trip at ${pps}`);
  }
  // A zero/negative/NaN zoom must not produce Infinity or NaN seconds.
  assert.equal(pxToTime(100, 0), 0);
  assert.equal(pxToTime(100, -40), 0);
  assert.equal(pxToTime(100, NaN), 0);
  assert.equal(timeToPx(NaN, 40), 0);
});

test('clientToTime folds in the viewport left edge AND the scroll, and never goes negative', () => {
  // Track viewport starts at x=200, scrolled 80px in, 40px per second.
  assert.equal(clientToTime(200, 200, 0, 40), 0);
  assert.equal(clientToTime(400, 200, 0, 40), 5);
  assert.equal(clientToTime(400, 200, 80, 40), 7);      // +80px of scroll = +2s
  assert.equal(clientToTime(200, 200, 80, 40), 2);
  // Left of the viewport with no scroll would be negative time; it clamps.
  assert.equal(clientToTime(100, 200, 0, 40), 0);
});

test('clampPxPerSec holds the zoom range, including junk input', () => {
  assert.equal(clampPxPerSec(1), MIN_PPS);
  assert.equal(clampPxPerSec(1e9), MAX_PPS);
  assert.equal(clampPxPerSec(40), 40);
  assert.equal(clampPxPerSec(NaN), MIN_PPS);
});

test('fitPxPerSec makes a duration fill the viewport, and survives a zero-length timeline', () => {
  const pps = fitPxPerSec(10, 824);
  assert.equal(pps, 80);                                  // (824 - 24 padding) / 10s
  assert.ok(timeToPx(10, pps) <= 824, 'the fitted duration never overflows the viewport');
  // A brand new, empty timeline must not divide by zero or blow past the zoom ceiling.
  const empty = fitPxPerSec(0, 800);
  assert.ok(empty >= MIN_PPS && empty <= MAX_PPS, `empty fit stayed in range: ${empty}`);
  assert.equal(fitPxPerSec(1e9, 800), MIN_PPS, 'an absurd duration floors at the min zoom');
});

test('zoomAbout keeps the instant under the cursor pinned, in and out', () => {
  const pps = 40, scrollLeft = 200, cursorPx = 300;
  const anchorBefore = pxToTime(cursorPx + scrollLeft, pps);   // 12.5s
  for (const factor of [1.25, 1 / 1.25, 4, 2]) {
    const z = zoomAbout(pps, factor, cursorPx, scrollLeft);
    const anchorAfter = pxToTime(cursorPx + z.scrollLeft, z.pxPerSec);
    assert.ok(z.scrollLeft > 0, `precondition: ${factor} still needs a scroll`);
    assert.ok(Math.abs(anchorAfter - anchorBefore) < 1e-6, `anchor held at ×${factor}: ${anchorAfter} vs ${anchorBefore}`);
  }
});

test('zoomAbout gives up the anchor rather than scrolling before t=0', () => {
  // Zooming far out can put the anchored instant left of the viewport's origin. There is
  // no negative scroll, so the anchor is deliberately surrendered and the view pins to
  // the start - the alternative is a scrollLeft the element would silently clamp anyway.
  const z = zoomAbout(40, 0.25, 300, 200);
  assert.equal(z.pxPerSec, 10);
  assert.equal(z.scrollLeft, 0, 'pinned to the start, never negative');
});

test('zoomAbout clamps at the range ends and cannot scroll past the start', () => {
  const atMax = zoomAbout(MAX_PPS, 4, 100, 0);
  assert.equal(atMax.pxPerSec, MAX_PPS, 'zooming in at the ceiling is a no-op zoom');
  const atMin = zoomAbout(MIN_PPS, 0.25, 100, 0);
  assert.equal(atMin.pxPerSec, MIN_PPS);
  assert.equal(atMin.scrollLeft, 0, 'zooming out at t=0 pins to the start, not a negative scroll');
});

// ── rebuild-vs-restyle memo ───────────────────────────────────────────────────

test('tracksKey is stable across GEOMETRY edits and changes on STRUCTURE edits', () => {
  const boxes = [clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 1), scenery('s')];
  const base = tracksKey(boxes, cfg);

  // Moving and trimming must NOT rebuild the rows - that is the whole point of the key.
  const moved = boxes.map((b) => (b.id === 'o' ? { ...b, start: 2.5 } : b));
  assert.equal(tracksKey(moved, cfg), base, 'a move does not change the row structure');
  const trimmed = boxes.map((b) => (b.id === 'a' ? { ...b, dur: 1.2 } : b));
  assert.equal(tracksKey(trimmed, cfg), base, 'a trim does not change the row structure');

  // Adding, removing, re-laning or un-timing a box MUST rebuild.
  assert.notEqual(tracksKey([...boxes, clip('c', 5, 1)], cfg), base, 'an added clip rebuilds');
  assert.notEqual(tracksKey(boxes.slice(1), cfg), base, 'a removed clip rebuilds');
  assert.notEqual(tracksKey(boxes.map((b) => (b.id === 'o' ? { ...b, lane: 'seq' } : b)), cfg), base, 'a lane change rebuilds');
  assert.notEqual(tracksKey(boxes.map((b) => (b.id === 'o' ? { ...b, start: '' } : b)), cfg), base, 'un-timing a box rebuilds');
});

test('tracksKey tolerates a hostile array without throwing', () => {
  assert.equal(tracksKey([] as Box[], cfg), '');
  assert.equal(typeof tracksKey([undefined, null, {}] as unknown as Box[], cfg), 'string');
  assert.equal(typeof tracksKey(null as unknown as Box[], cfg), 'string');
});

// ── snapping + seams ──────────────────────────────────────────────────────────

test('snapCandidates offers zero, every clip edge, the playhead and the nearby seconds', () => {
  const boxes = [clip('a', 0, 3), clip('b', 3, 2), overlay('o', 10, 1)];
  const cands = snapCandidates(boxes, cfg, 4.25, 10.4);
  for (const expect of [0, 3, 5, 10, 11, 4.25]) {
    assert.ok(cands.includes(expect), `offers ${expect} (got ${JSON.stringify(cands)})`);
  }
  // Bounded around the pointer, NOT every whole second up to the max.
  assert.ok(cands.every((c) => c <= 12.001), 'no candidate far past the pointer');
  assert.ok(cands.length < 20, `stays small: ${cands.length}`);
  assert.ok(cands.every((c) => c >= 0), 'never negative');
});

test('snapCandidates excludes the dragged clip, so it cannot snap to where it already is', () => {
  const boxes = [clip('a', 0, 3), clip('b', 3, 2)];
  const withA = snapCandidates(boxes, cfg, 0, 0.2);
  const withoutA = snapCandidates(boxes, cfg, 0, 0.2, 'a');
  assert.ok(withA.includes(3), 'a\'s end is a candidate for other drags');
  // 3 is also b's start, so it survives; what must go is a's own pair being counted twice.
  assert.ok(withoutA.length < withA.length, 'the dragged clip contributed fewer edges');
});

test('junctionAt finds the seam between adjacent clips, within a PIXEL tolerance', () => {
  const boxes = [clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 2)];
  const pps = 40;   // 8px tolerance = 0.2s

  const hit = junctionAt(boxes, cfg, 3.1, pps, 8);
  assert.deepEqual(hit, { aId: 'a', bId: 'b', t: 3 });
  assert.equal(junctionAt(boxes, cfg, 4.0, pps, 8), null, 'mid-clip is not a seam');
  assert.deepEqual(junctionAt(boxes, cfg, 5.15, pps, 8), { aId: 'b', bId: 'c', t: 5 });

  // The tolerance is in PIXELS, so zooming out widens it in seconds.
  assert.equal(junctionAt(boxes, cfg, 3.4, pps, 8), null, 'out of range at 40px/s');
  assert.ok(junctionAt(boxes, cfg, 3.4, 4, 8), 'the same time IS in range at 4px/s');
});

test('junctionAt returns null when there is no seam to find', () => {
  assert.equal(junctionAt([clip('a', 0, 3)], cfg, 0, 40, 8), null, 'a lone clip has no seam');
  assert.equal(junctionAt([], cfg, 0, 40, 8), null);
  assert.equal(junctionAt([clip('a', 0, 3), clip('b', 3, 2)], cfg, 3, 0, 8), null, 'a zero zoom cannot resolve one');
});

// ── keyboard containment ──────────────────────────────────────────────────────

test('isTextControl catches every surface the user types into', () => {
  const mk = (tag: string): HTMLElement => dom.window.document.createElement(tag);
  assert.equal(isTextControl(mk('input')), true);
  assert.equal(isTextControl(mk('textarea')), true);
  assert.equal(isTextControl(mk('select')), true);
  assert.equal(isTextControl(mk('button')), false);
  assert.equal(isTextControl(mk('div')), false);
  assert.equal(isTextControl(null), false);
  assert.equal(isTextControl(undefined), false);
  const ce = mk('div');
  Object.defineProperty(ce, 'isContentEditable', { value: true });
  assert.equal(isTextControl(ce), true, 'a contenteditable is a text control');
});

test('panelKeysActive: the panel owns keys only when it owns the interaction', () => {
  const root = dom.window.document.createElement('div');
  const inside = dom.window.document.createElement('button');
  const field = dom.window.document.createElement('input');
  root.append(inside, field);
  const outside = dom.window.document.createElement('button');
  dom.window.document.body.append(root, outside);

  assert.equal(panelKeysActive(root, inside, false), true, 'focus inside the panel');
  assert.equal(panelKeysActive(root, null, true), true, 'pointer over the panel');
  assert.equal(panelKeysActive(root, outside, false), false, 'focus on the canvas is the canvas\'s keys');
  assert.equal(panelKeysActive(root, null, false), false, 'neither focused nor hovered');
  // The critical one: typing in the panel's OWN numeric field must not fire shortcuts.
  assert.equal(panelKeysActive(root, field, true), false, 'typing beats hovering');
  assert.equal(panelKeysActive(root, field, false), false, 'typing beats focus containment');
  assert.equal(panelKeysActive(null, inside, true), false, 'no panel, no keys');
});

// ── density heuristics ────────────────────────────────────────────────────────

test('clampPanelH keeps the panel between its floor and half the stage', () => {
  assert.equal(clampPanelH(10, 1000), MIN_PANEL_H);
  assert.equal(clampPanelH(200, 1000), 200);
  assert.equal(clampPanelH(900, 1000), 500, 'never more than half the stage');
  // A stage shorter than twice the floor still yields the floor, not something smaller.
  assert.equal(clampPanelH(200, 100), MIN_PANEL_H);
  assert.equal(clampPanelH(NaN, 1000), MIN_PANEL_H);
});

test('clampPanelH floors above the measured chrome so the tracks can never be crushed to zero', () => {
  // Desktop-ish: one bar row, chrome well under MIN_PANEL_H - the constant still rules.
  assert.equal(clampPanelH(10, 1000, 70), MIN_PANEL_H, 'chrome below the floor changes nothing');
  // Phone-ish: .tl-bar has wrapped and a clip is selected, so the chrome alone (124px)
  // exceeds MIN_PANEL_H. Dragging the grip all the way down must still leave a lane.
  assert.equal(clampPanelH(10, 1000, 124), 124 + ONE_LANE_H);
  assert.ok(clampPanelH(10, 1000, 124) - 124 >= ONE_LANE_H, 'at least one lane survives the floor');
  // The floor also wins over a stage too short to halve into it.
  assert.equal(clampPanelH(500, 200, 124), 124 + ONE_LANE_H);
  // Absent/garbage chrome degrades to the two-argument behaviour rather than throwing.
  assert.equal(clampPanelH(10, 1000, NaN), MIN_PANEL_H);
  assert.equal(clampPanelH(10, 1000), MIN_PANEL_H);
});

test('tickStep picks the smallest step that keeps ruler labels ≥60px apart', () => {
  for (const pps of [4, 12, 40, 137, 600]) {
    const step = tickStep(pps);
    assert.ok(step * pps >= 60 || step === 600, `${step}s at ${pps}px/s is legible`);
  }
  assert.equal(tickStep(600), 0.1, 'zoomed right in, tenths');
  assert.equal(tickStep(60), 1);
  assert.ok(tickStep(4) >= 15, 'zoomed right out, coarse steps');
  assert.ok(tickStep(0) > 0, 'a degenerate zoom still yields a usable step');
});

test('frameCountFor stays bounded at both ends of a bar width', () => {
  assert.equal(frameCountFor(0), 1, 'a sliver still asks for one frame');
  assert.equal(frameCountFor(-100), 1);
  assert.equal(frameCountFor(1e6), 24, 'a huge bar is capped, not a decode storm');
  const mid = frameCountFor(400);
  assert.ok(mid > 1 && mid <= 24, `a normal bar asks for a few frames: ${mid}`);
  // Monotonic: a wider bar never asks for fewer frames.
  let prev = 0;
  for (const w of [0, 40, 120, 400, 1200, 5000]) {
    const n = frameCountFor(w);
    assert.ok(n >= prev, `monotonic at ${w}px`);
    prev = n;
  }
});

// ── what a bar paints (the branch, not the pixels) ───────────────────────────

test('isPaintedColor: "no background" is rgba(0,0,0,0), and must not light up has-thumbs', () => {
  assert.equal(isPaintedColor('rgba(0, 0, 0, 0)'), false, 'the computed value of no background');
  assert.equal(isPaintedColor('transparent'), false);
  assert.equal(isPaintedColor(''), false);
  assert.equal(isPaintedColor('rgba(20, 24, 29, 0.01)'), false, 'an invisible sliver of alpha is not a fill');
  assert.equal(isPaintedColor('rgb(20, 24, 29)'), true);
  assert.equal(isPaintedColor('rgba(20, 24, 29, 0.5)'), true);
  assert.equal(isPaintedColor('#14181d'), true);
  assert.equal(isPaintedColor('rgb(0 0 0 / 60%)'), true, 'the space-separated form is still a colour');
});

test('thumbMode: every clip kind picks its own picture, and a card falls back to its fill', () => {
  // The regression this exists to stop: before it, ONLY audio and video painted, so a
  // row of cards, images and tool clips was a row of identical coloured rectangles.
  assert.equal(thumbMode('audio', 'a.mp3', ''), 'waveform');
  assert.equal(thumbMode('video', 'a.mp4', ''), 'filmstrip');
  assert.equal(thumbMode('image', 'a.png', ''), 'still', 'an image box tiles one still');
  assert.equal(thumbMode('image', 'data:image/svg+xml,x', ''), 'still', 'a tool clip is an <img> like any other');
  assert.equal(thumbMode('lottie', 'anim.json', ''), 'still');
  // No media at all: the box's own colour, which is what it actually paints on frame.
  assert.equal(thumbMode('', '', 'rgb(20, 24, 29)'), 'fill');
  assert.equal(thumbMode('', '', 'rgba(0, 0, 0, 0)'), 'none', 'a transparent text box stays plain');
  assert.equal(thumbMode('', '', ''), 'none');
  // A media kind with no resolved url yet is not a picture - it falls back like a card.
  assert.equal(thumbMode('image', '', 'rgb(1, 2, 3)'), 'fill');
  assert.equal(thumbMode('video', '', ''), 'none');
});

test('thumbMode: a box worth photographing beats BOTH the flat fill and painting nothing', () => {
  // The gap this closes: a frame - a card, a text box, a pen shape, a composed group - 
  // has no media element, so it used to be one flat rectangle of its own background,
  // or (transparent text, and EVERY kind:'path' box, whose fill the hook forces to
  // transparent) literally nothing at all. A row of frames read as a row of blanks.
  assert.equal(thumbMode('', '', 'rgb(20, 24, 29)', true), 'node', 'a photograph beats a flat fill');
  assert.equal(thumbMode('', '', 'rgba(0, 0, 0, 0)', true), 'node', 'and beats painting nothing');
  // A decoded asset still wins: it is cheaper AND more faithful than a DOM photograph,
  // and a tool clip's <img> IS the compose render, not a screenshot of a tag.
  assert.equal(thumbMode('image', 'data:image/svg+xml,x', '', true), 'still');
  assert.equal(thumbMode('audio', 'a.mp3', '', true), 'waveform');
  assert.equal(thumbMode('video', 'v.mp4', '', true), 'filmstrip');
});

test('canRasterBox: photographs what has ink, declines what would come back blank', () => {
  const doc = dom.window.document;
  const box = (html: string): HTMLElement => {
    const el = doc.createElement('div');
    el.innerHTML = html;
    return el;
  };
  // A text card: transparent, but there is something to see.
  assert.equal(canRasterBox(box('<div class="lolly-box-text">Hello</div>'), 'rgba(0, 0, 0, 0)'), true);
  // A card: an opaque background is enough on its own.
  assert.equal(canRasterBox(box(''), 'rgb(20, 24, 29)'), true);
  // A pen shape: hooks.js forces kind:'path' boxes to fill:'transparent', so the
  // computed background says "nothing here" while the <svg> says otherwise.
  assert.equal(canRasterBox(box('<svg class="lolly-box-path"></svg>'), 'rgba(0, 0, 0, 0)'), true);
  // Nothing to photograph: a shot would cost a full dom-to-image call to produce a
  // blank bitmap, so the bar stays on 'none'.
  assert.equal(canRasterBox(box(''), 'rgba(0, 0, 0, 0)'), false);
  assert.equal(canRasterBox(box('<div class="lolly-box-text">   </div>'), ''), false, 'whitespace is not text');
  assert.equal(canRasterBox(null, 'rgb(20, 24, 29)'), false);
  // Past the subtree ceiling we decline rather than build it - the MAX_SVG_MARKUP
  // idiom. The limit is passed explicitly so this does not pin the constant's value.
  const big = box('<div class="lolly-box-text">Hello</div>');
  for (let i = 0; i < 12; i++) big.appendChild(doc.createElement('span'));
  assert.equal(canRasterBox(big, 'rgb(20, 24, 29)', 100), true, 'under the given ceiling');
  assert.equal(canRasterBox(big, 'rgb(20, 24, 29)', 5), false, 'over it, declined outright');
});

test('appearanceSig: a drag never invalidates a picture that has not changed a pixel', () => {
  // THE point of the signature. A drag rewrites start/dur on every pointermove; keying
  // the raster cache on the whole row would throw the photograph away and retake it at
  // the end of every gesture, on every bar the drag rippled.
  const a = { id: 'a', start: 0, dur: 2, clipIn: 0, speed: 1, lane: 'seq', bg: '#123', text: 'Hi' };
  const dragged = { ...a, start: 7.25, dur: 3, clipIn: 1.5, speed: 2, lane: '' };
  assert.equal(appearanceSig(a, cfg), appearanceSig(dragged, cfg));
  // Transitions are timing too - a fade length changes when the bar plays, not how it
  // looks at rest.
  assert.equal(appearanceSig(a, cfg), appearanceSig({ ...a, enter: 'fade', exitMs: 400 }, cfg));

  // Anything that changes the PICTURE changes the signature.
  assert.notEqual(appearanceSig(a, cfg), appearanceSig({ ...a, bg: '#456' }, cfg));
  assert.notEqual(appearanceSig(a, cfg), appearanceSig({ ...a, text: 'Bye' }, cfg));

  // The id is deliberately absent: two boxes that look identical may share one raster,
  // and one dom-to-image shot.
  assert.equal(appearanceSig(a, cfg), appearanceSig({ ...a, id: 'b' }, cfg));

  // Insertion order must not matter - the same row built by a seed and by a patch is
  // the same picture.
  const reordered = { text: 'Hi', bg: '#123', lane: 'seq', speed: 1, clipIn: 0, dur: 2, start: 0, id: 'a' };
  assert.equal(appearanceSig(a, cfg), appearanceSig(reordered, cfg));

  // null / undefined / '' are one "unauthored" state, not three.
  assert.equal(appearanceSig({ bg: null }, cfg), appearanceSig({ bg: '' }, cfg));
  assert.equal(appearanceSig({ bg: undefined }, cfg), appearanceSig({ bg: '' }, cfg));
  assert.equal(appearanceSig(undefined, cfg), '');
});

test('packSeqRow re-exports the magnetic pack: gapless from zero, in row order', () => {
  const packed = packSeqRow([clip('a', 9, 3), clip('b', 40, 2), overlay('o', 1, 1)], cfg);
  const seq = packed.filter((b) => b.lane === 'seq');
  assert.deepEqual(seq.map((b) => [b.id, b.start, b.dur]), [['a', 0, 3], ['b', 3, 2]]);
  assert.equal(packed.length, 3, 'the overlay is still there');
});

// ── the controller: one write per gesture ─────────────────────────────────────

/**
 * The add-kinds a HOST TOOL declares. Deliberately NOT sequence-studio's real list:
 * `widget` is a kind no module knows about, so a menu that renders it is a menu reading
 * the manifest rather than a hardcoded switch.
 */
const ADD_KINDS = [
  { id: 'clip', label: 'Clip' },
  { id: 'audio', label: 'Sound' },
  { id: 'widget', label: 'Widget' },
];

interface Harness {
  commits: Box[][];
  boxes: Box[];
  root: HTMLElement;
  /** The stage the panel is docked in - where `tl-*` / `fc-seek` cross the modules. */
  stageEl: HTMLElement;
  /** Every ids array the panel handed to `selection.set`, in order. */
  selSets: string[][];
  /** The tool canvas the panel reads media/mute state off. */
  canvasEl: HTMLElement;
  panel: {
    destroy(): void; setOpen(v: boolean): void; isOpen(): boolean;
    /** The one-commit promote free-canvas's timeline-armed create path calls. */
    promote(id: string, want?: { start?: number; dur?: number | null }): void;
    /** The playhead-contextual write seam free-canvas commits through (plans/104 section 8). */
    kfPoseIds(ids: readonly string[]): string[];
    kfPoseWrite(boxes: Box[], ids: readonly string[], delta: Record<string, number>, mode?: 'add' | 'set'): Box[];
    /** Camera mode, entered by SELECTION (plans/104 section 8) - the P1 half of the same seam. */
    cameraModeId(): string;
    cameraWrite(boxes: Box[], delta: Record<string, number>): Box[];
    cameraTiltPreview(boxes: Box[], dRx: number, dRy: number): { rx: number; ry: number } | null;
  };
  bar(id: string): HTMLElement;
  /** Drive the shared canvas selection, exactly as free-canvas would. */
  select(ids: string[]): void;
  reserves: number[];
  /** Fire the runtime notification a real commit would have caused. */
  notify(): void;
  teardown(): void;
}

/**
 * Mount the real panel on a jsdom stage. Rects are stubbed because jsdom has no
 * layout: the track viewport sits at x=0 and every bar is given the geometry the
 * panel's own restyle would have produced, so the gesture math reads real numbers.
 */
function mount(
  initial: Box[],
  pxPerSecHint = 40,
  addKinds: Array<{ id: string; label?: string; seed?: Record<string, unknown> }> = ADD_KINDS,
  extra: { host?: unknown; capabilities?: string[]; assetField?: string; linkField?: string; cfgPatch?: Record<string, unknown>; frameSize?: () => { w: number; h: number } | null } = {},
): Harness {
  const doc = dom.window.document;
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  doc.body.appendChild(stageEl);
  stageEl.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })) as never;

  const commits: Box[][] = [];
  const reserves: number[] = [];
  const selSets: string[][] = [];
  let boxes = initial.map((b) => ({ ...b }));
  let selected: string[] = [];
  let setSelection = (_ids: string[]): void => { /* replaced below, once the panel owns it */ };
  const selListeners = new Set<() => void>();
  const subs = new Set<() => void>();

  const panel = initTimelinePanel({
    stageEl, canvasEl,
    runtime: {
      subscribe: (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); },
      ...(extra.capabilities ? { manifest: { capabilities: extra.capabilities } } : {}),
    },
    host: extra.host ?? {},
    blockId: 'boxes',
    // `linkField` is the manifest's OPT-IN to detach/re-attach. Absent by default, so
    // every existing test still exercises a tool that never offers it.
    cfg: extra.linkField || extra.cfgPatch ? { ...cfg, ...(extra.linkField ? { linkField: extra.linkField } : {}), ...extra.cfgPatch } : cfg,
    getBoxes: () => boxes,
    commit: (next: Box[]) => { commits.push(next.map((b) => ({ ...b }))); boxes = next.map((b) => ({ ...b })); },
    selection: {
      get: () => selected,
      set: setSelection = (ids: string[]) => { selSets.push([...ids]); selected = ids; for (const f of selListeners) f(); },
      onChange: (cb: () => void) => { selListeners.add(cb); return () => { selListeners.delete(cb); }; },
    },
    reserve: (px: number) => { reserves.push(px); },
    ...(extra.frameSize ? { frameSize: extra.frameSize } : {}),
    addKinds,
    ...(extra.assetField ? { assetField: extra.assetField } : {}),
  } as never);

  // Stub the track viewport BEFORE opening: the panel fits its zoom to clientWidth on
  // first open, and jsdom reports 0 (which would leave the default zoom in place and make
  // every distance below unverifiable). 224px of viewport over a 5s timeline fits to
  // exactly (224 - 24) / 5 = 40px per second, which is what `bar()` lays the rects out at.
  const root = stageEl.querySelector('.tl-panel') as HTMLElement;
  const tracks = root.querySelector('.tl-tracks') as HTMLElement;
  tracks.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 224, height: 120, right: 224, bottom: 120, x: 0, y: 0, toJSON: () => ({}) })) as never;
  Object.defineProperty(tracks, 'clientWidth', { value: 24 + 5 * pxPerSecHint, configurable: true });
  panel.setOpen(true);

  const bar = (id: string): HTMLElement => {
    const el = root.querySelector(`.tl-clip[data-id="${id}"]`) as HTMLElement;
    assert.ok(el, `bar for ${id} exists`);
    const b = boxes.find((x) => x.id === id)!;
    const left = Number(b.start) * pxPerSecHint;
    const width = Number(b.dur) * pxPerSecHint;
    el.getBoundingClientRect = (() => ({ left, right: left + width, width, top: 0, bottom: 40, height: 40, x: left, y: 0, toJSON: () => ({}) })) as never;
    return el;
  };

  return {
    commits, root, panel, bar, reserves, canvasEl, stageEl, selSets,
    select: (ids: string[]) => setSelection(ids),
    notify() { for (const f of subs) f(); },
    get boxes() { return boxes; },
    teardown() { try { panel.destroy(); } catch { /* already gone */ } stageEl.remove(); },
  } as Harness;
}

/** A pointer event jsdom can build (it has no PointerEvent constructor). */
function pointer(type: string, clientX: number, extra: Record<string, unknown> = {}): Event {
  const e = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 20 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'button', { value: 0 });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  return e;
}

test('panel mounts as a stage child, outside the canvas, tagged [data-export-hide]', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const stage = h.root.parentElement!;
    assert.equal(h.root.className, 'tl-panel');
    assert.ok(h.root.hasAttribute('data-export-hide'), 'never walked into an SVG/PDF export');
    const canvas = stage.firstElementChild as HTMLElement;
    assert.equal(canvas.contains(h.root), false, 'the panel is a SIBLING of the canvas, never inside it');
    assert.ok(h.reserves.length > 0 && h.reserves[0]! > 0, 'opening reserved a stage band');
  } finally { h.teardown(); }
});

test('a move drag on an OVERLAY commits exactly once, on pointerup', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 1)]);
  try {
    const el = h.bar('o');
    // Press in the BODY of the bar (past the trim edge zone), then drag right.
    const grabAt = 40 + EDGE_PX + 4;
    el.dispatchEvent(pointer('pointerdown', grabAt));
    assert.equal(h.commits.length, 0, 'pointerdown alone writes nothing');

    for (const x of [grabAt + 10, grabAt + 40, grabAt + 80, grabAt + 120]) {
      h.root.dispatchEvent(pointer('pointermove', x));
      assert.equal(h.commits.length, 0, `pointermove at ${x} writes nothing`);
    }

    h.root.dispatchEvent(pointer('pointerup', grabAt + 120, { altKey: true }));
    assert.equal(h.commits.length, 1, 'EXACTLY one write for the whole gesture');

    const written = h.commits[0]!.find((b) => b.id === 'o')!;
    // 120px at 40px/s = +3s, from a start of 1s. Alt bypasses snapping so the
    // arithmetic is checkable exactly.
    assert.equal(written.start, 4, 'the drag distance became the new start');
    assert.equal(written.dur, 1, 'a move never changes the length');
    // Nothing else moved.
    assert.deepEqual(h.commits[0]!.filter((b) => b.lane === 'seq').map((b) => [b.id, b.start]), [['a', 0], ['b', 3]]);
  } finally { h.teardown(); }
});

test('a press with no movement commits nothing at all', () => {
  const h = mount([clip('a', 0, 3), overlay('o', 1, 1)]);
  try {
    const el = h.bar('o');
    const at = 40 + EDGE_PX + 4;
    el.dispatchEvent(pointer('pointerdown', at));
    el.dispatchEvent(pointer('pointermove', at + 1));   // under the 2px slop
    h.root.dispatchEvent(pointer('pointerup', at + 1));
    assert.equal(h.commits.length, 0, 'a click selects, it does not edit');
  } finally { h.teardown(); }
});

test('a cancelled drag commits nothing', () => {
  const h = mount([clip('a', 0, 3), overlay('o', 1, 1)]);
  try {
    const el = h.bar('o');
    const at = 40 + EDGE_PX + 4;
    el.dispatchEvent(pointer('pointerdown', at));
    h.root.dispatchEvent(pointer('pointermove', at + 100));
    h.root.dispatchEvent(pointer('pointercancel', at + 100));
    assert.equal(h.commits.length, 0, 'pointercancel abandons the gesture');
    // And a later stray pointerup must not resurrect it.
    h.root.dispatchEvent(pointer('pointerup', at + 100));
    assert.equal(h.commits.length, 0);
  } finally { h.teardown(); }
});

test('a trim drag on a clip edge commits exactly once and keeps the row gapless', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    // Grab within EDGE_PX of the bar's right edge (3s × 40px/s = 120px).
    const at = 120 - 2;
    el.dispatchEvent(pointer('pointerdown', at));
    h.root.dispatchEvent(pointer('pointermove', at - 40));
    assert.equal(h.commits.length, 0);
    h.root.dispatchEvent(pointer('pointerup', at - 40, { altKey: true }));
    assert.equal(h.commits.length, 1, 'EXACTLY one write for the trim');

    const seq = h.commits[0]!.filter((b) => b.lane === 'seq');
    assert.equal(Number(seq.find((b) => b.id === 'a')!.dur), 2, 'shortened by 40px = 1s');
    assert.equal(Number(seq.find((b) => b.id === 'b')!.start), 2, 'the row repacked gapless behind it');
  } finally { h.teardown(); }
});

test('a reorder drag on the seq row commits exactly once and lands in the right slot', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    // Grab a's middle (60px = 1.5s) and drag past b's midpoint (4s = 160px).
    el.dispatchEvent(pointer('pointerdown', 60));
    for (const x of [100, 150, 200]) {
      h.root.dispatchEvent(pointer('pointermove', x));
      assert.equal(h.commits.length, 0, `pointermove to ${x} writes nothing`);
    }
    h.root.dispatchEvent(pointer('pointerup', 200, { altKey: true }));
    assert.equal(h.commits.length, 1, 'EXACTLY one write for the reorder');

    const seq = h.commits[0]!.filter((b) => b.lane === 'seq');
    // b, then a - and repacked gapless, which is the whole point of the magnetic row.
    assert.deepEqual(
      seq.map((b) => [b.id, b.start, b.dur]).sort((x, y) => Number(x[1]) - Number(y[1])),
      [['b', 0, 2], ['a', 2, 3]],
    );
  } finally { h.teardown(); }
});

test('a reorder drag that does not clear a midpoint commits nothing', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', 60));
    h.root.dispatchEvent(pointer('pointermove', 90));   // 2.25s: still short of b's 4s midpoint
    h.root.dispatchEvent(pointer('pointerup', 90, { altKey: true }));
    assert.equal(h.commits.length, 0, 'the index never changed, so there is nothing to write');
  } finally { h.teardown(); }
});

test('closing the panel releases the stage reserve', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    assert.ok(h.reserves.some((r) => r > 0), 'open reserved');
    h.panel.setOpen(false);
    assert.equal(h.reserves[h.reserves.length - 1], 0, 'close released the band');
    assert.equal(h.panel.isOpen(), false);
  } finally { h.teardown(); }
});


/** Let jsdom run its rAF callbacks (paint + scheduleSync are both rAF-coalesced). */
function frames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const step = (): void => { if (--left <= 0) resolve(); else dom.window.requestAnimationFrame(step); };
    dom.window.requestAnimationFrame(step);
  });
}

// ── leaked-state regressions ──────────────────────────────────────────────────

test('a reorder clears is-drop-target on release - a stale ring cannot outlive the drag', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', 60));
    h.root.dispatchEvent(pointer('pointermove', 200));
    await frames(3);
    const marked = () => Array.from(h.root.querySelectorAll('.tl-clip.is-drop-target')).map((n) => (n as HTMLElement).dataset.id);
    assert.deepEqual(marked(), ['b'], 'the clip the drop would displace is highlighted during the drag');
    h.root.dispatchEvent(pointer('pointerup', 200, { altKey: true }));
    // A reorder leaves array order and lanes alone, so tracksKey is unchanged and the
    // next sync takes the restyle branch - nothing will ever rebuild this class away.
    assert.deepEqual(marked(), [], 'and it is gone the instant the pointer lifts');
  } finally { h.teardown(); }
});

test('closing the panel under a live resize drag cannot re-reserve the stage band', async () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    const handle = h.root.querySelector('.tl-handle') as HTMLElement;
    handle.dispatchEvent(pointer('pointerdown', 100));
    h.root.dispatchEvent(pointer('pointermove', 100));
    await frames(3);
    h.panel.setOpen(false);                       // Escape is reachable mid-drag
    assert.equal(h.reserves[h.reserves.length - 1], 0, 'closing released the band');
    // Whatever the pointer does next must not re-reserve behind a hidden panel.
    h.root.dispatchEvent(pointer('pointermove', 60));
    h.root.dispatchEvent(pointer('pointerup', 60));
    await frames(3);
    assert.equal(h.reserves[h.reserves.length - 1], 0, 'still released');
    assert.equal(h.root.hidden, true);
  } finally { h.teardown(); }
});

test('a lost pointer capture does not wedge the panel into ignoring the model forever', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.bar('a').dispatchEvent(pointer('pointerdown', 60));
    h.root.dispatchEvent(new dom.window.Event('lostpointercapture', { bubbles: true }));
    // With the gesture abandoned, a model change must reach the panel again.
    h.boxes.push(overlay('o', 1, 1) as never);
    h.notify();
    await frames(3);
    assert.ok(h.root.querySelector('.tl-clip[data-id="o"]'), 'the new row was picked up');
  } finally { h.teardown(); }
});

// ── promotion / demotion: timing is reachable for ANY box ─────────────────────
//
// The regression these pin: the `text` / `image` / `lottie` / `tool` add-kinds seed
// neither a lane nor a start, so the box is scenery - and before this the ONLY way to
// give one a time was to hand-edit the ?boxes= URL. The inspector gated on `bars`
// (timed clips only) and the scenery chip did nothing but select.

/** The inspector control sitting under a given field label. */
function field(root: HTMLElement, label: string): HTMLInputElement {
  // BOTH scopes: a shut group keeps its body in its own segment inside `.tl-inspector`,
  // and an OPEN one has lent it to the body-mounted popover (plans/104 section 8's M2.5
  // revision), which is not a descendant of the panel at all.
  const rows = Array.from(root.ownerDocument!.querySelectorAll<HTMLElement>(
    '.tl-inspector .tl-field, .tl-group-pop .tl-field'));
  // Text labels for the timing rows; the compact audio strip's icon labels carry
  // the same string as aria-label instead (the 2026-09-02 compaction).
  const r = rows.find((x) => x.querySelector('.field-label')?.textContent === label
    || x.querySelector('.tl-alab')?.getAttribute('aria-label') === label);
  assert.ok(r, `the inspector has a "${label}" field (got ${JSON.stringify(rows.map((x) => x.querySelector('.field-label')?.textContent))})`);
  return r!.querySelector('.field-input, .field-select') as HTMLInputElement;
}

/** Type into a field the way a user leaving it does: value, then `change`. */
function type(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

const timingBtn = (root: HTMLElement): HTMLButtonElement => {
  const b = root.querySelector('.tl-inspector .tl-timing') as HTMLButtonElement;
  assert.ok(b, 'the inspector offers the timed ⇄ always-on switch');
  return b;
};

test('the inspector opens for an UNTIMED box, with empty Start/Length and the transitions', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    assert.ok(h.root.querySelector('.tl-chip[data-id="s"]'), 'precondition: s is a scenery chip, not a bar');
    assert.equal(h.root.querySelector('.tl-clip[data-id="s"]'), null, 'precondition: s has no bar');
    assert.equal(h.root.querySelectorAll('.tl-inspector .tl-field').length, 0, 'nothing selected, nothing shown');

    h.select(['s']);
    const start = field(h.root, 'Start');
    const len = field(h.root, 'Length');
    assert.equal(start.value, '', 'Start is EMPTY, not a misleading 0');
    assert.equal(len.value, '', 'Length is EMPTY, not a misleading 0');
    assert.equal(start.placeholder, '-');
    // The animate controls are authorable before the box is timed.
    assert.ok(field(h.root, 'Enter'), 'Enter is reachable');
    assert.ok(field(h.root, 'Exit'), 'Exit is reachable');
    assert.equal(timingBtn(h.root).textContent, 'Add to the timeline');
    // Playback-only fields stay out of the way until there is something playing.
    assert.equal(h.root.querySelector('.tl-inspector .tl-mute'), null, 'no mute on a box with no span');
  } finally { h.teardown(); }
});

// ── the inspector ARRIVES rather than appearing ───────────────────────────────
//
// From a screen recording of the studio: selecting a clip made a whole row of controls
// materialise in the toolbar between two adjacent video frames, and the row was BOTH
// unannounced and half-unreachable. Two separate defects, pinned separately.

test('the inspector leaves the layout entirely when nothing is selected', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const ins = h.root.querySelector('.tl-inspector') as HTMLElement;
    assert.ok(ins, 'precondition: the row exists');
    assert.equal(ins.hidden, true, 'no selection, no row - not an empty box still claiming the bar gap');

    h.select(['a']);
    assert.equal(ins.hidden, false, 'selecting a clip brings the row back');
    assert.ok(ins.querySelectorAll('.tl-field').length > 0, 'and it has its fields');

    // The orphan this pins: the row outlived its selection for the whole remainder of
    // the recording, with no selected clip anywhere to explain why it was there.
    h.select([]);
    assert.equal(ins.hidden, true, 'dropping the selection takes the row with it');
    assert.equal(ins.querySelectorAll('.tl-field').length, 0, 'and empties it');
  } finally { h.teardown(); }
});

test('the entrance cue runs on ARRIVAL only, not on every rebuild', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const ins = h.root.querySelector('.tl-inspector') as HTMLElement;
    h.select(['a']);
    // The class lands a tick later, deliberately: on the same style pass that built the
    // row the animation is coalesced away and never plays.
    assert.equal(ins.classList.contains('is-entering'), false, 'not in the same pass as the build');
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(ins.classList.contains('is-entering'), true, 'the arrival is announced');

    // A field edit rebuilds the row against new values. That is a CHANGE, not an
    // arrival - re-running the cue on every scrub and every keystroke is its own noise.
    ins.classList.remove('is-entering');
    type(field(h.root, 'Length'), '2');
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(ins.classList.contains('is-entering'), false, 'a rebuild is not an arrival');

    // Leaving and coming back IS an arrival again.
    h.select([]);
    h.select(['b']);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(ins.classList.contains('is-entering'), true, 're-selecting announces again');
  } finally { h.teardown(); }
});

test('the inspector never right-aligns its overflow off the unreachable start edge', () => {
  // Not a layout assertion - jsdom has no layout. This pins the STYLE RULE, because the
  // bug was purely declarative and invisible to every behavioural test: with
  // `justify-content: flex-end` on a scroll container, content overflowing the START
  // edge cannot be scrolled back to (scrollLeft is already 0), so Start, Length, Trim in,
  // Speed and Enter were permanently off the left edge of a narrow panel and only
  // the tail of the row could ever be reached.
  const css = readFileSync(new URL('../styles/parts/timeline.css', import.meta.url), 'utf8');
  // Comments out first: the rule that replaced the defect NAMES the defect, so a raw
  // text scan finds `flex-end` in the prose explaining why it is gone.
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = decls.slice(decls.indexOf('.tl-inspector {'), decls.indexOf('.tl-field {'));
  assert.ok(block.includes('justify-content: flex-start'),
    'the inspector packs from the start, so nothing overflows the edge that cannot be scrolled to');
  assert.ok(!/justify-content:\s*flex-end/.test(block),
    'flex-end is the defect itself - it must not come back');
  assert.ok(/\.tl-inspector\s*>\s*:first-child\s*\{[^}]*margin-inline-start:\s*auto/.test(decls),
    'the right-aligned look comes from an auto start margin, which collapses instead of clipping');
});

// ── authored easing ───────────────────────────────────────────────────────────
//
// The state that has to survive: UNAUTHORED. The kind's built-in curve is what every
// box has always animated with, and the whole reason the compositor's output is still
// byte-identical is that nothing writes an ease field until someone asks for one. A
// control that helpfully seeded `ease-out` on first render would author a curve into
// every box the user ever selected, and there would be no way back to the original.

const easeSel = (root: HTMLElement, label: string): HTMLSelectElement =>
  field(root, label) as unknown as HTMLSelectElement;

const pick = (el: HTMLSelectElement, value: string): void => {
  el.value = value;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};

test('the easing control opens on the BUILT-IN curve, and rendering it writes nothing', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const inSel = easeSel(h.root, 'Enter curve');
    const outSel = easeSel(h.root, 'Exit curve');
    assert.equal(inSel.value, '', 'unauthored is a real state, and it is the default one');
    assert.equal(outSel.value, '');
    assert.equal(inSel.options[0]!.value, '', 'the built-in is an OPTION, not an implied absence of one');
    assert.equal(h.commits.length, 0, 'showing the inspector is not an edit');
    assert.equal('enterEase' in h.boxes[0]!, false, 'and the field was never written');

    // Every named curve is on offer, plus the route to the editor.
    const values = Array.from(inSel.options).map((o) => o.value);
    assert.deepEqual(values, ['', 'linear', 'ease-out', 'ease-in', 'ease-in-out', 'overshoot', 'anticipate', 'smooth', 'snappy', '__custom']);
  } finally { h.teardown(); }
});

test('choosing a preset is exactly ONE commit, carrying the wire string', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.select(['a']);
    pick(easeSel(h.root, 'Enter curve'), 'overshoot');
    assert.equal(h.commits.length, 1, 'one commit, one undo step - like every other field in this row');
    assert.equal(h.commits[0]!.find((b) => b.id === 'a')!.enterEase, 'overshoot');
    assert.equal(h.commits[0]!.find((b) => b.id === 'b')!.enterEase, undefined, 'and only the selected box');

    // Back to the built-in, through the same one control.
    h.notify();
    pick(easeSel(h.root, 'Enter curve'), '');
    assert.equal(h.commits.length, 2);
    assert.equal(h.commits[1]!.find((b) => b.id === 'a')!.enterEase, '', 'the built-in is reachable again');

    h.notify();
    pick(easeSel(h.root, 'Exit curve'), 'anticipate');
    assert.equal(h.commits[2]!.find((b) => b.id === 'a')!.exitEase, 'anticipate', 'in and out are independent');
  } finally { h.teardown(); }
});

test('an authored bezier brings its own option, showing the numbers rather than "Custom"', () => {
  const h = mount([{ ...clip('a', 0, 3), enterEase: 'cubic-bezier(0.2,1.4,0.6,1)' } as Box]);
  try {
    h.select(['a']);
    const sel = easeSel(h.root, 'Enter curve');
    assert.equal(sel.value, 'cubic-bezier(0.2,1.4,0.6,1)', 'the control shows the value the model holds');
    const opt = Array.from(sel.options).find((o) => o.value === sel.value)!;
    assert.equal(opt.textContent, 'cubic-bezier(0.2,1.4,0.6,1)', 'a curve nobody can see is not described by the word "Custom"');
  } finally { h.teardown(); }
});

test('"Custom…" is a route, not a value: it opens the editor and leaves the model alone', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const sel = easeSel(h.root, 'Enter curve');
    pick(sel, '__custom');
    assert.equal(h.commits.length, 0, 'opening the editor is not an edit');
    assert.equal(sel.value, '', 'and the control never shows a state the model is not in');
    const pop = openMenu('.tl-ease-pop');
    assert.ok(pop, 'the curve editor opened');
    assert.ok(pop!.querySelector('.ease-ed-plot'), 'with the plot in it');
    assert.equal(pop!.parentElement, dom.window.document.body,
      'body-mounted - a fixed popover parented inside the panel is knocked off screen by any ancestor transform');
  } finally { h.teardown(); }
});

test('the curve editor writes through the SAME one-commit path as every other field', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    pick(easeSel(h.root, 'Enter curve'), '__custom');
    const read = openMenu('.tl-ease-pop')!.querySelector('.ease-ed-input') as HTMLInputElement;
    read.value = 'cubic-bezier(0.1,0.9,0.2,1.4)';
    read.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit');
    assert.equal(h.commits[0]!.find((b) => b.id === 'a')!.enterEase, 'cubic-bezier(0.1,0.9,0.2,1.4)');
  } finally { h.teardown(); }
});

test('Escape closes the curve editor and puts focus back on the control that opened it', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const sel = easeSel(h.root, 'Enter curve');
    pick(sel, '__custom');
    assert.ok(openMenu('.tl-ease-pop'), 'precondition: it is up');
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(openMenu('.tl-ease-pop'), null, 'Escape closes it - the standing repo rule');
    assert.equal(dom.window.document.activeElement, sel, 'and focus comes back to the trigger, not to <body>');
    assert.equal(h.commits.length, 0, 'opened and abandoned, the box is as unauthored as it was');
  } finally { h.teardown(); }
});

test('destroying the panel takes the curve editor with it', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    pick(easeSel(h.root, 'Enter curve'), '__custom');
    assert.ok(openMenu('.tl-ease-pop'), 'precondition: a card is up');
  } finally { h.teardown(); }
  assert.equal(openMenu('.tl-ease-pop'), null, 'no orphan popover left on <body>');
});

test('a tool that never declared an ease sub-field is offered no curve control', () => {
  // The manifest is the contract: writing `enterEase` into a box for a tool whose hook
  // does not read it is inventing a field, which is exactly what linkField's absence
  // already gates the whole detach feature on.
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { enterEaseField: undefined, exitEaseField: undefined } });
  try {
    h.select(['a']);
    const labels = Array.from(h.root.querySelectorAll('.tl-inspector .field-label')).map((n) => n.textContent);
    assert.ok(labels.includes('Enter'), 'precondition: the transition fields are still there');
    assert.equal(labels.includes('Enter curve'), false);
    assert.equal(labels.includes('Exit curve'), false);
  } finally { h.teardown(); }
});

// ── Appears: one control for the three ways a box arrives (plans/179 M4) ──────
//
// The regression these pin is a MODEL one, not a look: before the segmented control a
// box could carry a build step AND a start, and the presenter, the video compositor and
// the .pptx writer each resolved that pair differently. The patch the row writes comes
// from lib/motion-model.ts and is exclusive by construction, so the state cannot be
// authored from this UI at all.

/** The Appears segment buttons, in the order the row lays them out. */
const appearBtns = (root: HTMLElement): HTMLButtonElement[] =>
  Array.from(root.ownerDocument!.querySelectorAll<HTMLButtonElement>(
    '.tl-inspector .tl-appear-seg .view-seg-btn, .tl-group-pop .tl-appear-seg .view-seg-btn'));

const pressedAppear = (root: HTMLElement): string =>
  appearBtns(root).find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? '';

test('the Appears row reads the box, and each segment writes the EXCLUSIVE patch', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.select(['a']);
    assert.deepEqual(appearBtns(h.root).map((b) => b.textContent), ['With the slide', 'On click', 'At time'],
      'three ways to appear, one control, in the order they are learned');
    assert.equal(pressedAppear(h.root), 'At time', 'a timed clip already appears at a time');

    // → On click. The patch carries ALL FOUR fields, every time: that is what makes two
    // answers impossible, so the assertion is about the keys as much as the values.
    appearBtns(h.root)[1]!.click();
    assert.equal(h.commits.length, 1, 'ONE commit - one undo step');
    const clicked = h.commits[0]!.find((b) => b.id === 'a')!;
    assert.equal(clicked.build, 1, 'the first advance, unless the box already had a step');
    assert.equal(clicked.start, '', 'and no start');
    assert.equal(clicked.dur, '');
    assert.equal(clicked.lane, '');
    for (const k of ['build', 'start', 'dur', 'lane']) {
      assert.ok(k in clicked, `${k} is in the patch - the clear is an EMPTY STRING, never a missing key`);
    }
    assert.equal(h.commits[0]!.find((b) => b.id === 'b')!.build, undefined, 'and only the selected box');

    h.notify();
    await frames(3);
    assert.equal(pressedAppear(h.root), 'On click', 'the row is a reading of the model, not a memory of the press');
    type(field(h.root, 'step'), '3');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.build, 3, 'the step is editable where it applies');

    // → With the slide clears all three ways.
    h.notify();
    await frames(3);
    appearBtns(h.root)[0]!.click();
    const plain = h.boxes.find((b) => b.id === 'a')!;
    assert.deepEqual([plain.build, plain.start, plain.dur, plain.lane], ['', '', '', ''],
      'nothing left standing from either of the other two');
    h.notify();
    await frames(3);
    assert.equal(pressedAppear(h.root), 'With the slide');
  } finally { h.teardown(); }
});

test('a tool whose time fields are not the model\'s own is offered no Appears row', () => {
  // The patch names Design\'s field ids (`build`/`start`/`dur`/`lane`) - the same
  // manifest-is-the-contract rule the ease sub-fields are gated by. A tool that names
  // its start something else must not be handed a control that would write a field its
  // hook never declared.
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { startField: 'start2' } });
  try {
    h.select(['a']);
    assert.equal(appearBtns(h.root).length, 0);
  } finally { h.teardown(); }
});

// ── a frame's enter/exit is the author overriding the deck (M4 section 1c) ────

const FRAME_CFG = { cfgPatch: { frameTransitionField: 'slideTransition' } };
const frameBox = (id: string, start: number, dur: number): Box =>
  ({ id, start, dur, lane: 'seq', kind: 'frame' });

test('editing a FRAME\'s enter marks its transition custom, in the same patch', () => {
  const h = mount([frameBox('f', 0, 3), clip('b', 3, 2)], 40, ADD_KINDS, FRAME_CFG);
  try {
    h.select(['f']);
    pick(field(h.root, 'Enter') as unknown as HTMLSelectElement, 'fade');
    assert.equal(h.commits.length, 1, 'ONE commit: the pair and the override are one edit');
    const f = h.commits[0]!.find((b) => b.id === 'f')!;
    assert.equal(f.enter, 'fade');
    assert.equal(f.slideTransition, 'custom',
      'nothing derives a transition over a pair the author has just set by hand');

    h.notify();
    pick(field(h.root, 'Exit') as unknown as HTMLSelectElement, 'none');
    assert.equal(h.commits[1]!.find((b) => b.id === 'f')!.slideTransition, 'custom', 'the exit says it too');
  } finally { h.teardown(); }
});

test('a frame is offered no Appears row - a slide does not arrive on its own slide', () => {
  const h = mount([frameBox('f', 0, 3), clip('b', 3, 2)], 40, ADD_KINDS, FRAME_CFG);
  try {
    h.select(['f']);
    assert.equal(appearBtns(h.root).length, 0, 'and a build step on a frame is a number no player reads');
    assert.ok(field(h.root, 'Enter'), 'precondition: the rest of the Motion group is still there');
  } finally { h.teardown(); }
});

test('the custom stamp is manifest-gated, and never lands on an ordinary box', () => {
  // No declared field: nothing to stamp, and inventing one is the defect.
  const noField = mount([frameBox('f', 0, 3), clip('b', 3, 2)]);
  try {
    noField.select(['f']);
    pick(field(noField.root, 'Enter') as unknown as HTMLSelectElement, 'fade');
    assert.equal('slideTransition' in noField.commits[0]!.find((b) => b.id === 'f')!, false);
  } finally { noField.teardown(); }

  // A box that is not a frame has no transition to the next slide at all.
  const notFrame = mount([clip('a', 0, 3), clip('b', 3, 2)], 40, ADD_KINDS, FRAME_CFG);
  try {
    notFrame.select(['a']);
    pick(field(notFrame.root, 'Enter') as unknown as HTMLSelectElement, 'fade');
    assert.equal('slideTransition' in notFrame.commits[0]!.find((b) => b.id === 'a')!, false);
  } finally { notFrame.teardown(); }
});

// ── playOnce: the preview beside Enter, and the navigator's transition chip ───

test('playOnce ramps ONE element through its own entrance and hands the DOM back', async () => {
  const doc = dom.window.document;
  const host = doc.createElement('div');
  host.innerHTML = `<div class="artboard" data-sequence data-seq-ms="4000">
    <div class="lolly-box" id="p" data-t-start="1000" data-t-dur="1000"
         data-t-enter="fade" data-t-enter-ms="400" style="left:0px;top:0px"></div>
    <div class="lolly-box" id="q" style="left:0px;top:0px"></div>
  </div>`;
  doc.body.appendChild(host);
  const el = doc.getElementById('p') as HTMLElement;
  const untouched = doc.getElementById('q') as HTMLElement;
  try {
    // A wall clock and a queue, so the ramp is driven rather than waited on - the same
    // seams driveSequenceTime takes for the same reason.
    let now = 0;
    let pending: (() => void) | null = null;
    const done = playOnce(el, 400, {
      now: () => now,
      schedule: (fn) => { pending = fn; return () => { pending = null; }; },
    });
    // The FIRST frame is applied before anything is scheduled: the entrance starts at
    // its own start, not at the top of the sequence.
    assert.equal(el.style.opacity, '0', 'the box begins its fade where the render begins it');
    assert.equal(untouched.getAttribute('style'), 'left:0px;top:0px',
      'a box with no timing of its own is not part of anybody\'s preview');

    now = 200;
    pending!();
    assert.ok(Number(el.style.opacity) > 0 && Number(el.style.opacity) < 1, 'half way through, half way in');

    now = 400;
    pending!();
    await done;
    assert.equal(el.style.opacity, '', 'restored: the preview composes nothing it does not take back');
    assert.equal(el.style.transform, '');
    assert.equal(el.classList.contains('seq-off'), false);
    assert.equal(el.style.left, '0px', 'and the authored geometry is still the author\'s');
  } finally { host.remove(); }
});

test('the Enter row offers the preview only where there is motion to play, and it is not an edit', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.select(['a']);
    assert.equal(inspEl('.tl-preview'), null,
      'no box on the canvas, nothing stamped, nothing to play - absent, never a dead button');

    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.dataset.boxId = 'a';
    for (const [k, v] of Object.entries({
      'data-t-start': '0', 'data-t-dur': '3000', 'data-t-enter': 'fade', 'data-t-enter-ms': '400',
    })) el.setAttribute(k, v);
    el.setAttribute('style', 'left:0px;top:0px');
    h.canvasEl.appendChild(el);
    h.select([]);
    h.select(['a']);
    const btn = inspEl<HTMLButtonElement>('.tl-preview');
    assert.ok(btn, 'a timed box on screen has an entrance, so it has a preview');
    assert.equal(btn!.getAttribute('aria-label'), 'Preview this motion');
    btn!.click();
    assert.equal(h.commits.length, 0, 'watching a motion is not authoring one');
    // Let the ramp finish so the element is handed back before the panel goes.
    await new Promise((r) => { setTimeout(r, 480); });
    // NOT LEFT HALF-DRAWN, which is the one state a preview must never end in. What
    // remains is either the authored pose or the pose the panel's own clock re-asserts
    // when the preview hands the canvas back (a fade at the playhead's 0 is invisible) -
    // never a frame from the middle of the ramp.
    assert.ok(['', '0'].includes(el.style.opacity),
      `the preview ended mid-entrance at opacity ${el.style.opacity}`);
    assert.equal(el.classList.contains('seq-off'), false, 'and nothing is left hidden');
  } finally { h.teardown(); }
});

test('playOnce plays an entrance on a page that was never placed in order, and unstamps it', async () => {
  // The navigator's slide-transition chip: it stamps the enter kind on the page it is
  // about to show and takes it off again. A deck that has never been put on a timeline
  // has no start anywhere, and the applier only walks elements that have one - so the
  // player supplies a 0 for the length of the ramp, and the page keeps its own shape.
  const doc = dom.window.document;
  const canvas = doc.createElement('div');
  const page = doc.createElement('div');
  page.className = 'lolly-frame-page';
  page.setAttribute('data-t-enter', 'fade');
  page.setAttribute('data-t-enter-ms', '400');
  page.setAttribute('style', 'left:0px;top:0px');
  canvas.appendChild(page);
  doc.body.appendChild(canvas);
  try {
    let now = 0;
    let pending: (() => void) | null = null;
    const done = playOnce(page, 400, { now: () => now, schedule: (fn) => { pending = fn; return () => { pending = null; }; } });
    assert.equal(page.getAttribute('data-t-start'), '0', 'a start it did not have, for as long as it needs one');
    assert.equal(page.style.opacity, '0', 'and the entrance actually runs');
    now = 400;
    pending!();
    await done;
    assert.equal(page.hasAttribute('data-t-start'), false, 'absent stays absent');
    assert.equal(page.style.opacity, '', 'and the pose came back off');
  } finally { canvas.remove(); }
});

test('playOnce on an element with no timing of its own does nothing at all', async () => {
  const doc = dom.window.document;
  const el = doc.createElement('div');
  el.className = 'lolly-box';
  el.setAttribute('style', 'left:0px');
  doc.body.appendChild(el);
  try {
    await playOnce(el, 400);
    await playOnce(el, 0);
    await playOnce(null, 400);
    assert.equal(el.getAttribute('style'), 'left:0px');
  } finally { el.remove(); }
});

test('typing a Start promotes an untimed box in EXACTLY ONE commit, onto an overlay lane', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    const before = tracksKey(h.boxes, cfg);
    h.select(['s']);
    type(field(h.root, 'Start'), '2');
    assert.equal(h.commits.length, 1, 'ONE commit - one undo step for the whole promotion');

    const written = h.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.start, 2, 'the typed start landed');
    // Documented default: no media on the canvas, so the length is DEFAULT_CLIP_S - the
    // same 3 s the magnetic pack gives a clip it cannot measure.
    assert.equal(written.dur, 3, 'the length defaulted to the pack default');
    assert.equal(written.lane, '', 'promoted onto an OVERLAY lane, never onto the magnetic row');
    // The seq row is untouched: promotion must not repack anyone else.
    assert.deepEqual(h.commits[0]!.filter((b) => b.lane === 'seq').map((b) => [b.id, b.start, b.dur]), [['a', 0, 3], ['b', 3, 2]]);

    assert.notEqual(tracksKey(h.boxes, cfg), before, 'the row STRUCTURE changed, so the panel must rebuild');
    h.notify();
    await frames(3);
    assert.ok(h.root.querySelector('.tl-clip[data-id="s"]'), 'and it now has a bar on a lane');
    assert.equal(h.root.querySelector('.tl-chip[data-id="s"]'), null, 'it left the scenery strip');
  } finally { h.teardown(); }
});

test('typing only a Length promotes at the PLAYHEAD, still one commit', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    h.select(['s']);
    type(field(h.root, 'Length'), '1.5');
    assert.equal(h.commits.length, 1, 'ONE commit');
    const written = h.commits[0]!.find((b) => b.id === 's')!;
    // The clock has never been seeked in this harness, so the playhead is at 0 - which
    // is the documented default for a Length-only promotion.
    assert.equal(written.start, 0, 'start defaulted to the playhead');
    assert.equal(written.dur, 1.5, 'the typed length landed');
  } finally { h.teardown(); }
});

test('leaving the empty Start field untouched promotes nothing', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    h.select(['s']);
    // Tabbing through a field fires `change` in some browsers; an empty field must not
    // be read as "start at 0" and quietly time the box.
    type(field(h.root, 'Start'), '');
    type(field(h.root, 'Length'), '');
    assert.equal(h.commits.length, 0, 'an untouched empty field writes nothing');
  } finally { h.teardown(); }
});

test('the scenery chip\'s + button promotes straight from the strip, one commit', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    const add = h.root.querySelector('.tl-chip-add[data-id="s"]') as HTMLElement;
    assert.ok(add, 'the chip carries a promote affordance');
    add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit from the chip too');
    const written = h.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.start, 0, 'placed at the playhead');
    assert.equal(written.dur, 3, 'with the default length');
    h.notify();
    await frames(3);
    assert.ok(h.root.querySelector('.tl-clip[data-id="s"]'), 'it is on a lane');
  } finally { h.teardown(); }
});

test('promote with dur:null authors a REAL length when the open window would be empty', () => {
  // The free-canvas create path passes `dur: null` ("author nothing - run open-ended
  // to the sequence end"). That window is EMPTY when the start is at the end of an
  // already-derived sequence - and the playhead, the default start, parks exactly
  // there after every play-through - so the "+ then pick" flow was minting a
  // permanently zero-length clip nobody could see, scrub to, or play.
  const atEnd = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    atEnd.canvasEl.setAttribute('data-seq-ms', '5000');
    atEnd.panel.promote('s', { start: 5, dur: null });
    const written = atEnd.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.start, 5, 'the start still lands at the end');
    assert.equal(written.dur, 3, 'a real length is authored, so the sequence extends to hold it');
  } finally { atEnd.teardown(); }

  // On a doc with NO derived sequence yet, unauthored stays right: the hook's
  // DEFAULT_SEQ_S fallback opens a window for the first timed box, and authoring here
  // is what would pin a 45s track to 3s before its picker ever opened (the same
  // contract free-canvas-timeline-add.test.ts pins from the other side).
  const untimed = mount([scenery('s')]);          // no data-seq-ms: a doc with no timeline yet
  try {
    untimed.panel.promote('s', { start: 0, dur: null });
    const written = untimed.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.dur, '', 'the first timed box on an untimed doc stays unauthored');
  } finally { untimed.teardown(); }

  // Mid-sequence, "author nothing" keeps meaning open-ended-to-the-end - the case the
  // null contract exists for (a 45s track must not be pinned to 3s before its picker opens).
  const mid = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    mid.canvasEl.setAttribute('data-seq-ms', '5000');
    mid.panel.promote('s', { start: 2, dur: null });
    const written = mid.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.start, 2);
    assert.equal(written.dur, '', 'mid-sequence stays unauthored: open-ended to the end');
  } finally { mid.teardown(); }
});

test('overlay lanes render top = frontmost, the NLE track order (plans/165 C-tracks)', async () => {
  // Array order is paint order, so the LAST overlay in the array is the frontmost
  // layer on canvas - and must take the TOP track row, with the seq row the floor.
  const h = mount([overlay('back', 0, 2), overlay('front', 1, 2), clip('a', 0, 3)]);
  try {
    await frames(3);
    const rows = Array.from(h.root.querySelectorAll<HTMLElement>('.tl-lane[data-lane="overlay"]'));
    assert.equal(rows.length, 2, 'one row per ungrouped overlay');
    assert.equal(rows[0]!.dataset.anchor, 'front', 'the top row anchors the frontmost box');
    assert.equal(rows[1]!.dataset.anchor, 'back', 'the backmost box sits nearest the seq row');
    const seqRow = h.root.querySelector('.tl-lane-seq');
    assert.ok(seqRow && rows[1]!.compareDocumentPosition(seqRow) & 4 /* FOLLOWING */, 'the seq row stays the floor');
  } finally { h.teardown(); }
});

test('a timed OVERLAY demotes back to scenery in one commit - "always on" is not a trap', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 1)]);
  try {
    const before = tracksKey(h.boxes, cfg);
    h.select(['o']);
    const toggle = timingBtn(h.root);
    assert.equal(toggle.textContent, 'Make always on', 'a timed box offers the reverse');
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit');

    const written = h.commits[0]!.find((b) => b.id === 'o')!;
    assert.equal(written.start, '', 'start CLEARED - an empty field, never a 0');
    assert.equal(written.dur, '');
    assert.equal(written.lane, '');
    assert.notEqual(tracksKey(h.boxes, cfg), before, 'un-timing changes the row structure');

    h.notify();
    await frames(3);
    assert.ok(h.root.querySelector('.tl-chip[data-id="o"]'), 'it is back in the scenery strip');
    assert.equal(h.root.querySelector('.tl-clip[data-id="o"]'), null, 'and its bar is gone');
  } finally { h.teardown(); }
});

test('demoting a SEQ clip closes the gap it leaves, inside the same commit', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 1)]);
  try {
    h.select(['a']);
    timingBtn(h.root).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit');
    const seq = h.commits[0]!.filter((b) => b.lane === 'seq');
    assert.deepEqual(
      seq.map((b) => [b.id, b.start, b.dur]),
      [['b', 0, 2], ['c', 2, 1]],
      'the magnetic row repacked gapless from zero',
    );
    assert.equal(h.commits[0]!.find((b) => b.id === 'a')!.start, '', 'and a is scenery');
  } finally { h.teardown(); }
});

test('a promoted box round-trips: promote, demote, and the model is scenery again', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), scenery('s')]);
  try {
    h.select(['s']);
    type(field(h.root, 'Start'), '4');
    assert.equal(h.commits.length, 1);
    // The inspector re-rendered against the now-timed box, so the switch flipped.
    const toggle = timingBtn(h.root);
    assert.equal(toggle.textContent, 'Make always on');
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.commits.length, 2, 'one commit each way, never a compound step');
    const written = h.commits[1]!.find((b) => b.id === 's')!;
    assert.equal(written.start, '');
    assert.equal(written.dur, '');
  } finally { h.teardown(); }
});

// ── the `+` menu and the tl-add seam ──────────────────────────────────────────
//
// The complaint these pin (Andy, 2026-07-27): "I have no way to add audio outside of
// the export menu, I'd like it in the timeline." The panel does not create boxes - it
// dispatches `tl-add` with an add-kind id and the playhead, and free-canvas's create
// pipeline does the rest. What is checked here is the CONTRACT: the kinds come from the
// manifest, and the time is the live playhead.

const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); };

/** Every `tl-add` that bubbles out of the panel, in order. */
function recordAdds(h: Harness): Array<{ kind: string; atMs: number }> {
  const seen: Array<{ kind: string; atMs: number }> = [];
  h.root.parentElement!.addEventListener('tl-add', (e) => {
    seen.push((e as CustomEvent).detail as { kind: string; atMs: number });
  });
  return seen;
}

/** The body-mounted menu currently open, if any. */
const openMenu = (cls = '.tl-menu'): HTMLElement | null => dom.window.document.querySelector(cls);
const menuLabels = (el: HTMLElement | null): string[] =>
  Array.from(el?.querySelectorAll('.folder-menu-item') ?? []).map((n) => n.textContent?.trim() ?? '');

/** Move the playhead by scrubbing the ruler (Alt bypasses snapping, so it is exact). */
function seekTo(h: Harness, sec: number, pxPerSecHint = 40): void {
  const ruler = h.root.querySelector('.tl-ruler') as HTMLElement;
  const x = sec * pxPerSecHint;
  ruler.dispatchEvent(pointer('pointerdown', x, { altKey: true }));
  h.root.dispatchEvent(pointer('pointerup', x, { altKey: true }));
}

test('the + menu lists the TOOL\'s declared add-kinds, not a hardcoded set', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    const add = h.root.querySelector('.tl-tools .tl-add') as HTMLButtonElement;
    assert.ok(add, 'the tool group carries an add button');
    assert.equal(add.hidden, false);
    assert.equal(add.getAttribute('aria-haspopup'), 'menu');
    click(add);
    const menu = openMenu();
    assert.ok(menu, 'clicking opens a menu');
    assert.deepEqual(menuLabels(menu), ['Clip', 'Sound', 'Widget'],
      'exactly the manifest\'s kinds, in its order - including one no module knows about');
    assert.equal(add.getAttribute('aria-expanded'), 'true');
  } finally { h.teardown(); }
});

test('a tool with no add-kinds gets no + button rather than an empty menu', () => {
  const h = mount([clip('a', 0, 3)], 40, []);
  try {
    assert.equal((h.root.querySelector('.tl-tools .tl-add') as HTMLButtonElement).hidden, true);
  } finally { h.teardown(); }
});

test('choosing a kind dispatches tl-add with that kind and the CURRENT playhead', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const adds = recordAdds(h);
    seekTo(h, 2.5);
    click(h.root.querySelector('.tl-tools .tl-add')!);
    const audio = Array.from(openMenu()!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim() === 'Sound');
    assert.ok(audio, 'AUDIO is one click away from the timeline - the whole point');
    click(audio!);
    assert.deepEqual(adds, [{ kind: 'audio', atMs: 2500 }], 'the kind id and the playhead, in ms');
    assert.equal(h.commits.length, 0, 'the panel never creates the box itself');
    assert.equal(openMenu(), null, 'and the menu closed behind the choice');
  } finally { h.teardown(); }
});

test('the empty-sequence dropslot still works - it dispatches tl-add for a clip', () => {
  // Overlay only: the seq row is empty, which is the only time the slot renders.
  const h = mount([overlay('o', 1, 1)]);
  try {
    const adds = recordAdds(h);
    const slot = h.root.querySelector('.tl-dropslot') as HTMLElement;
    assert.ok(slot, 'an empty seq row still offers "Add a clip"');
    click(slot);
    assert.deepEqual(adds, [{ kind: 'clip', atMs: 0 }]);
  } finally { h.teardown(); }
});

// ── the bar / chip context menu ───────────────────────────────────────────────

/** Right-click an element the way a browser does. */
function rightClick(el: Element): void {
  el.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 300 }));
}

test('right-clicking a scenery chip offers promotion, and it is ONE commit', () => {
  const h = mount([clip('a', 0, 3), scenery('s')]);
  try {
    rightClick(h.root.querySelector('.tl-chip[data-id="s"]')!);
    const menu = openMenu('.tl-ctx-menu');
    assert.ok(menu, 'a context menu opened');
    assert.deepEqual(menuLabels(menu), ['Add to the timeline', 'Delete'],
      'an untimed box is offered a time, not a split');
    click(menu!.querySelector('.folder-menu-item')!);
    assert.equal(h.commits.length, 1, 'ONE commit - the same promote() the inspector calls');
    const written = h.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(written.start, 0, 'placed at the playhead');
    assert.equal(written.dur, 3, 'with the pack default length');
    assert.equal(written.lane, '', 'on an overlay lane, never the magnetic row');
    assert.equal(openMenu('.tl-ctx-menu'), null, 'the menu closed');
  } finally { h.teardown(); }
});

test('right-clicking a timed bar offers split + demote + delete, and demote is ONE commit', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 1)]);
  try {
    rightClick(h.bar('o'));
    const menu = openMenu('.tl-ctx-menu');
    assert.deepEqual(menuLabels(menu), ['Split at playhead', 'Make always on', 'Delete']);
    const demote = Array.from(menu!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim() === 'Make always on')!;
    click(demote);
    assert.equal(h.commits.length, 1, 'ONE commit - demote(), not a second implementation');
    const written = h.commits[0]!.find((b) => b.id === 'o')!;
    assert.equal(written.start, '', 'start CLEARED to empty, never a 0');
    assert.equal(written.dur, '');
    assert.equal(written.lane, '');
  } finally { h.teardown(); }
});

test('the context menu selects what it acts on, and Delete removes exactly that box', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    rightClick(h.bar('b'));
    assert.deepEqual(h.root.querySelector('.tl-clip[data-id="b"]')?.getAttribute('aria-selected'), 'true',
      'right-click selected the bar it opened on');
    const del = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim() === 'Delete')!;
    click(del);
    assert.equal(h.commits.length, 1, 'ONE commit');
    assert.deepEqual(h.commits[0]!.map((b) => b.id), ['a'], 'only b went');
  } finally { h.teardown(); }
});

test('right-clicking INSIDE a multi-selection collapses it to the clicked box', () => {
  // Every item in this menu acts on the right-clicked box alone. Leaving three bars
  // painted as selected while "Make always on" demotes one of them shows a state that
  // never existed, and the user's next act is an undo of something they did not do.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 1)]);
  try {
    h.select(['a', 'b', 'o']);
    rightClick(h.bar('b'));
    assert.deepEqual(
      Array.from(h.root.querySelectorAll('.tl-clip[aria-selected="true"]')).map((n) => (n as HTMLElement).dataset.id),
      ['b'],
      'the selection collapsed to the box the menu is about',
    );
    const demote = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim() === 'Make always on')!;
    click(demote);
    assert.equal(h.commits.length, 1, 'ONE commit');
    assert.equal(h.commits[0]!.find((b) => b.id === 'b')!.start, '', 'and only b was demoted');
    assert.equal(h.commits[0]!.find((b) => b.id === 'a')!.start, 0, 'a is untouched');
  } finally { h.teardown(); }
});

test('the context menu is keyboard reachable (Shift+F10) and Escape closes it', () => {
  const h = mount([clip('a', 0, 3), scenery('s')]);
  try {
    const el = h.bar('a');
    el.focus();
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    assert.ok(openMenu('.tl-ctx-menu'), 'Shift+F10 opens the menu on the focused bar');
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(openMenu('.tl-ctx-menu'), null, 'Escape closes it - the standing repo rule');
    assert.equal(h.commits.length, 0, 'opening and closing a menu edits nothing');
  } finally { h.teardown(); }
});

test('destroying the panel takes its body-mounted menus with it', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    click(h.root.querySelector('.tl-tools .tl-add')!);
    assert.ok(openMenu(), 'precondition: a menu is up');
  } finally { h.teardown(); }
  assert.equal(openMenu(), null, 'no orphan popover left on <body>');
});

test('deleting the focused clip keeps focus inside the panel, so the keyboard stays alive', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', 60));
    h.root.dispatchEvent(pointer('pointerup', 60));
    el.focus();
    assert.equal(dom.window.document.activeElement, el);
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    assert.equal(h.commits.length, 1, 'the delete committed');
    h.notify();
    await frames(3);
    const active = dom.window.document.activeElement as HTMLElement;
    assert.ok(h.root.contains(active), `focus stayed in the panel (was ${active.tagName})`);
  } finally { h.teardown(); }
});

// ── record-in-place voiceover (track C) ───────────────────────────────────────
//
// The panel's mic button opens a real host.recorder session, runs the playhead
// through the take, and lands the result as an audio box. What is asserted below is
// the OUTPUT: the committed Box[], the asset actually written to the host's user
// store, and the panel's own DOM. The host bridge is a stand-in (as `commit` already
// is) because it is the shell boundary this module talks through.
//
// BROWSER-ONLY, not covered here: whether the microphone permission prompt appears
// where a real user expects it, whether the take's audio is audible/clean, whether
// muting the composition actually stops sound reaching the mic, and the waveform the
// inserted bar paints (canvas 2D + a real decode). Those need a device.

/** The add-kinds a timed tool declares, WITH the manifest's audio seed. */
const AUDIO_KINDS = [
  { id: 'clip', label: 'Clip' },
  { id: 'audio', label: 'Sound', seed: { kind: 'audio' } },
];

interface FakeRecorder {
  host: unknown;
  /** Live microphone references held by the meter - must be 0 after every path. */
  meterRefs(): number;
  sessions(): number;
  cancels(): number;
  uploads(): Map<string, { type?: string; meta?: Record<string, unknown> }>;
  /** Let a gated (`gateMeter`) permission prompt resolve. */
  grant(): void;
  /** Let a held (`holdUpload`) asset write finish. */
  finishUpload(): void;
  /** What the last `record()` was asked for (video/frame/maxMs), or null. */
  lastRecordOpts(): Record<string, unknown> | null;
}

/**
 * A host bridge with a v1.17 recorder and a user-asset store, both in memory.
 *
 * `gateMeter` models the REAL meter's refcount contract (bridge/recorder.ts): the count is
 * taken synchronously, a follower shares the leader's in-flight `getUserMedia` promise, and
 * every resolved start owes exactly one stop. That contract is the only way to catch a take
 * whose continuation resumes after it was abandoned.
 * `holdUpload` keeps an asset write in flight so a save can be abandoned mid-flight.
 */
function fakeHost(opts: { deny?: boolean; bytes?: number; gateMeter?: boolean; holdUpload?: boolean } = {}): FakeRecorder {
  let refs = 0;
  let sessions = 0;
  let cancels = 0;
  let open = false;
  let starting: Promise<void> | null = null;
  let grant = (): void => { /* replaced when a gated start is in flight */ };
  let finishUpload = (): void => { /* replaced when a held upload is in flight */ };
  const uploads = new Map<string, { type?: string; meta?: Record<string, unknown> }>();
  let lastRecordOpts: Record<string, unknown> | null = null;
  const host = {
    log: () => { /* quiet */ },
    recorder: {
      isAvailable: () => true,
      meter: {
        start: async () => {
          if (opts.deny) { const e = new Error('denied') as Error & { name: string }; e.name = 'NotAllowedError'; throw e; }
          refs++;
          if (!opts.gateMeter || open) return;
          if (!starting) {
            starting = new Promise<void>((res) => { grant = () => { open = true; starting = null; res(); }; });
          }
          await starting;
        },
        stop: () => { refs = Math.max(0, refs - 1); if (refs === 0) open = false; },
        subscribe: () => () => { /* no levels in jsdom */ },
      },
      record: async (o?: Record<string, unknown>) => {
        sessions++;
        lastRecordOpts = o ?? null;
        return {
          subscribe: () => () => { /* no levels in jsdom */ },
          stop: async () => new Blob([new Uint8Array(opts.bytes ?? 2048)], { type: 'audio/webm;codecs=opus' }),
          cancel: () => { cancels++; },
        };
      },
      still: async () => new Blob([]),
    },
    assets: {
      get: async (id: string) => ({
        source: 'user', id, type: uploads.get(id)?.type ?? 'audio', format: 'webm',
        url: `blob:${id}`, meta: uploads.get(id)?.meta,
      }),
      _uploadUserAsset: async (record: { id: string; type?: string; meta?: Record<string, unknown> }) => {
        if (opts.holdUpload) await new Promise<void>((res) => { finishUpload = res; });
        uploads.set(record.id, record);
      },
      _deleteUserAsset: async (id: string) => { uploads.delete(id); },
    },
  };
  return {
    host, meterRefs: () => refs, sessions: () => sessions, cancels: () => cancels, uploads: () => uploads,
    grant: () => grant(), finishUpload: () => finishUpload(), lastRecordOpts: () => lastRecordOpts,
  };
}

/** Resolve when the panel announces it has reached `phase`. */
function takeReaches(root: HTMLElement, phase: string): Promise<void> {
  return new Promise((resolve) => {
    const on = (e: Event): void => {
      if ((e as CustomEvent).detail?.phase !== phase) return;
      root.removeEventListener('tl-take', on);
      resolve();
    };
    root.addEventListener('tl-take', on);
  });
}

/**
 * Paint the canvas boxes the clock (and the take's mute pass) reads. `data-seq-ms` is
 * what makes the clock playable at all - it refuses to run a zero-length sequence.
 */
function paintCanvasBoxes(h: Harness): HTMLElement[] {
  h.canvasEl.setAttribute('data-seq-ms', '10000');
  return h.boxes.map((b) => {
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String(b.id));
    h.canvasEl.appendChild(el);
    return el;
  });
}

/** Freeze the wall clock the take measures itself against. */
function fakeClock(): { set(ms: number): void; restore(): void } {
  const real = globalThis.performance.now;
  let at = 100000;
  globalThis.performance.now = () => at;
  return { set: (ms: number) => { at = ms; }, restore: () => { globalThis.performance.now = real; } };
}

test('the mic button needs a recording host and an audio add-kind - NOT a manifest capability', () => {
  // No recording host: the shipped default for every shell that cannot capture audio.
  const plain = mount([clip('a', 0, 3)], 40, AUDIO_KINDS);
  try {
    assert.equal((plain.root.querySelector('.tl-mic') as HTMLElement).hidden, true, 'no host.recorder → no button');
  } finally { plain.teardown(); }

  // A capable shell but no audio add-kind: a take would have no box to become.
  const noAudio = mount([clip('a', 0, 3)], 40, [{ id: 'clip', label: 'Clip' }], { host: fakeHost().host });
  try {
    assert.equal((noAudio.root.querySelector('.tl-mic') as HTMLElement).hidden, true, 'no audio add-kind → no button');
  } finally { noAudio.teardown(); }

  // Capable shell + audio vocabulary and NO declared capability - the shipping
  // sequence-studio manifest. Progressive enhancement, like host.media's live camera:
  // declaring `microphone` would mean "cannot run without a mic", which hides the tool
  // from the TUI gallery and drops it from the CLI smoke gate. Nothing opens the mic
  // until the button is pressed, so its presence risks no permission prompt.
  const ready = mount([clip('a', 0, 3)], 40, AUDIO_KINDS, { host: fakeHost().host });
  try {
    const mic = ready.root.querySelector('.tl-mic') as HTMLElement;
    assert.equal(mic.hidden, false, 'host + audio kind → the button is offered');
    assert.equal(mic.getAttribute('aria-pressed'), 'false');
  } finally { ready.teardown(); }
});

test('a completed take inserts ONE audio box at the playhead, with the MEASURED length', async () => {
  const fake = fakeHost();
  const clock = fakeClock();
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const h = mount([clip('a', 0, 5)], 40, AUDIO_KINDS, { host: fake.host, capabilities: ['microphone'] });
  const painted = paintCanvasBoxes(h);
  try {
    seekTo(h, 2);                        // the playhead sits at 2s (the shared ruler helper)
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;

    const live = takeReaches(h.root, 'recording');
    click(mic);
    await live;

    assert.equal(mic.getAttribute('aria-pressed'), 'true', 'the button reads as live');
    assert.equal((h.root.querySelector('.tl-rec') as HTMLElement).hidden, false, 'the take HUD is up');
    assert.equal(h.root.querySelector('.tl-play')?.getAttribute('aria-label'), 'Pause',
      'the playhead RUNS during the take - the transport says so');
    assert.ok(painted.every((el) => el.getAttribute('data-t-mute') === '1'),
      'the composition is silenced in the clock\'s own vocabulary while recording');
    assert.equal(h.commits.length, 0, 'nothing is written to the model until the take lands');

    clock.set(104200);                   // 4.2 s of take
    const done = takeReaches(h.root, 'idle');
    click(mic);
    await done;

    assert.equal(h.commits.length, 1, 'ONE commit for the insertion - one undo step');
    const next = h.commits[0]!;
    assert.equal(next.length, 2, 'exactly one box was added');
    const box = next.find((b) => b.id !== 'a')!;
    assert.equal(box.kind, 'audio', 'born from the manifest\'s audio add-kind seed');
    assert.equal(box.start, 2, 'placed where the playhead was when the take began');
    assert.equal(box.dur, 4.2, 'the MEASURED elapsed length, not the blob\'s');

    const ref = box.image as { id: string; type: string };
    assert.match(ref.id, /^user\/recording\/\d+\.webm$/, 'stored as a durable user asset');
    const stored = fake.uploads().get(ref.id)!;
    assert.equal(stored.type, 'audio', 'typed audio, not a silent video');
    assert.equal(stored.meta?.durationMs, 4200,
      'meta.durationMs is what becomes data-audio-dur - without it the box cannot be trimmed');

    assert.equal(fake.meterRefs(), 0, 'the sound-check microphone reference was released');
    assert.ok(painted.every((el) => !el.hasAttribute('data-t-mute')), 'the composition is audible again');
    assert.equal((h.root.querySelector('.tl-rec') as HTMLElement).hidden, true, 'the HUD is gone');
    assert.equal(mic.getAttribute('aria-pressed'), 'false');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; clock.restore(); }
});

/** The sequence vocabulary a camera take needs: a clip kind (what it becomes) beside the
 *  audio kind the mic uses. Seeds mirror community/design's manifest. */
const RECORD_KINDS = [
  { id: 'clip', label: 'Clip', seed: { kind: 'image', lane: 'seq', fit: 'cover' } },
  { id: 'audio', label: 'Audio', seed: { kind: 'audio' } },
];

test('the camera button needs a video-capable recorder and a clip add-kind', () => {
  // A shell whose recorder captures audio only (isAvailable('video') false).
  const audioOnly = fakeHost();
  const base = audioOnly.host as { recorder: { isAvailable: (k?: string) => boolean } };
  const onlyMic = { ...base, recorder: { ...base.recorder, isAvailable: (k?: string) => k !== 'video' } };
  const noVideo = mount([clip('a', 0, 3)], 40, RECORD_KINDS, { host: onlyMic });
  try {
    assert.equal((noVideo.root.querySelector('.tl-cam') as HTMLElement).hidden, true, 'no video capture → no button');
    assert.equal((noVideo.root.querySelector('.tl-mic') as HTMLElement).hidden, false, 'the mic is unaffected');
  } finally { noVideo.teardown(); }

  // A capable shell but no clip kind: the take would have no box to become.
  const noClip = mount([clip('a', 0, 3)], 40, AUDIO_KINDS.filter((k) => k.id !== 'clip'), { host: fakeHost().host });
  try {
    assert.equal((noClip.root.querySelector('.tl-cam') as HTMLElement).hidden, true, 'no clip add-kind → no button');
  } finally { noClip.teardown(); }

  const ready = mount([clip('a', 0, 3)], 40, RECORD_KINDS, { host: fakeHost().host });
  try {
    const cam = ready.root.querySelector('.tl-cam') as HTMLElement;
    assert.equal(cam.hidden, false, 'host + clip kind → the button is offered');
    assert.equal(cam.getAttribute('aria-label'), 'Record a video');
    assert.equal(cam.getAttribute('aria-pressed'), 'false');
  } finally { ready.teardown(); }
});

test('a completed video take records the EXPORT frame and hands the clip to the canvas at the playhead', async () => {
  const fake = fakeHost();
  const clock = fakeClock();
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const h = mount([clip('a', 0, 5)], 40, RECORD_KINDS, { host: fake.host, frameSize: () => ({ w: 1080, h: 1920 }) });
  const painted = paintCanvasBoxes(h);
  const adds: Array<Record<string, unknown>> = [];
  h.root.addEventListener('tl-add', (e) => { adds.push((e as CustomEvent).detail as Record<string, unknown>); });
  try {
    seekTo(h, 2);
    const cam = h.root.querySelector('.tl-cam') as HTMLButtonElement;
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;

    const live = takeReaches(h.root, 'recording');
    click(cam);
    await live;

    assert.equal(cam.getAttribute('aria-pressed'), 'true', 'the camera button reads as live');
    assert.equal(mic.disabled, true, 'one take at a time: the mic waits');
    assert.ok(h.stageEl.querySelector('.tl-cam-view video'), 'the self-view is up on the stage');
    assert.equal((h.stageEl.querySelector('.tl-cam-view') as HTMLElement).style.aspectRatio, '1080 / 1920',
      'the self-view box wears the export aspect');
    const asked = fake.lastRecordOpts()!;
    assert.equal(asked.video, true, 'camera + mic');
    assert.deepEqual(asked.frame, { width: 1080, height: 1920 }, 'the take is cropped to the export frame');
    assert.ok(painted.every((el) => el.getAttribute('data-t-mute') === '1'), 'the composition is silenced while recording');

    clock.set(104200);                   // 4.2 s of take
    const done = takeReaches(h.root, 'idle');
    click(cam);
    await done;

    assert.equal(h.commits.length, 0, 'the PANEL writes nothing - the canvas owns clip geometry');
    assert.equal(adds.length, 1, 'one tl-add carried the take to the canvas');
    const add = adds[0]!;
    assert.equal(add.kind, 'clip', 'born as the sequence clip kind');
    assert.equal(add.atMs, 2000, 'placed where the playhead was when the take began');
    assert.equal(add.durSec, 4.2, 'the MEASURED length rides along');
    const ref = add.asset as { id: string };
    assert.match(ref.id, /^user\/recording\/\d+\.webm$/, 'stored as a durable user asset');
    const stored = fake.uploads().get(ref.id)!;
    assert.equal(stored.type, 'video', 'typed VIDEO, not an audio take');
    assert.equal(stored.meta?.durationMs, 4200);

    assert.equal(h.stageEl.querySelector('.tl-cam-view'), null, 'the self-view is gone');
    assert.equal(cam.getAttribute('aria-pressed'), 'false');
    assert.equal(mic.disabled, false, 'the mic is back');
    assert.equal(fake.meterRefs(), 0, 'the sound-check microphone reference was released');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; clock.restore(); }
});

test('screen recording uses the native screen source and lands as one timeline clip', async () => {
  const fake = fakeHost();
  const clock = fakeClock();
  const h = mount([clip('a', 0, 5)], 40, RECORD_KINDS, { host: fake.host });
  paintCanvasBoxes(h);
  const adds: Array<Record<string, unknown>> = [];
  h.root.addEventListener('tl-add', (e) => { adds.push((e as CustomEvent).detail as Record<string, unknown>); });
  try {
    seekTo(h, 1.5);
    const screen = h.root.querySelector('.tl-screen') as HTMLButtonElement;
    assert.equal(screen.hidden, false, 'a screen-capable recorder + clip kind offers the control');

    const live = takeReaches(h.root, 'recording');
    click(screen);
    await live;

    assert.equal(screen.getAttribute('aria-pressed'), 'true');
    assert.equal(fake.meterRefs(), 0, 'screen capture does not open a separate sound-check microphone');
    assert.equal(h.stageEl.querySelector('.tl-cam-view'), null, 'screen capture has no camera self-view');
    assert.deepEqual(fake.lastRecordOpts(), {
      source: 'screen', audio: true, systemAudio: true, video: true,
      format: 'mp4', maxMs: TAKE_TIMING.videoMaxMs,
    }, 'the host gets its native screen/window/tab capture request');

    clock.set(103600);
    const done = takeReaches(h.root, 'idle');
    click(screen);
    await done;

    assert.equal(adds.length, 1, 'one saved screen take enters through the clip creation seam');
    assert.equal(adds[0]!.kind, 'clip');
    assert.equal(adds[0]!.atMs, 1500);
    assert.equal(adds[0]!.durSec, 3.6);
    const ref = adds[0]!.asset as { id: string };
    assert.equal(fake.uploads().get(ref.id)?.type, 'video', 'stored as video even when the test recorder falls back to WebM');
  } finally { h.teardown(); clock.restore(); }
});

test('re-taking over a selected take REPLACES its asset in one commit', async () => {
  const fake = fakeHost();
  const clock = fakeClock();
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const existing: Box = {
    id: 'vo', start: 1, dur: 3, lane: '', clipIn: 1.5, kind: 'audio',
    image: { source: 'user', id: 'user/recording/1.webm', type: 'audio', url: 'blob:old' } as never,
  };
  const h = mount([clip('a', 0, 5), existing], 40, AUDIO_KINDS, { host: fake.host, capabilities: ['microphone'] });
  try {
    h.select(['vo']);
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;
    assert.equal(mic.getAttribute('aria-label'), 'Record over this take',
      'the button says what the next press will do');

    const live = takeReaches(h.root, 'recording');
    click(mic);
    await live;
    clock.set(101800);
    const done = takeReaches(h.root, 'idle');
    click(mic);
    await done;

    assert.equal(h.commits.length, 1, 'ONE commit for the replacement - one undo step');
    const next = h.commits[0]!;
    assert.equal(next.length, 2, 'no box was added; the existing one was rewritten');
    const box = next.find((b) => b.id === 'vo')!;
    const ref = box.image as { id: string };
    assert.notEqual(ref.id, 'user/recording/1.webm', 'the asset was swapped');
    assert.equal(box.dur, 1.8, 'and re-fitted to the new take\'s measured length');
    assert.equal(box.clipIn, 0, 'the old trim-in pointed into audio that no longer exists');
    assert.equal(box.start, 1, 'the box stays where it was');
    assert.equal(fake.uploads().has('user/recording/1.webm'), false, 'the superseded take was retired');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; clock.restore(); }
});

test('a denied microphone leaves no recording state and says so', async () => {
  const fake = fakeHost({ deny: true });
  const h = mount([clip('a', 0, 3)], 40, AUDIO_KINDS, { host: fake.host, capabilities: ['microphone'] });
  const painted = paintCanvasBoxes(h);
  try {
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;
    const done = takeReaches(h.root, 'idle');
    click(mic);
    await done;

    assert.equal(mic.getAttribute('aria-pressed'), 'false', 'the button is not stuck in the pressed state');
    assert.equal(mic.disabled, false, 'and it is pressable again');
    assert.equal((h.root.querySelector('.tl-rec') as HTMLElement).hidden, true, 'no HUD left behind');
    const note = h.root.querySelector('.tl-rec-note') as HTMLElement;
    assert.equal(note.hidden, false);
    assert.match(note.textContent || '', /Microphone blocked/, 'the user is told what happened');
    assert.equal(fake.sessions(), 0, 'no recorder session was ever opened');
    assert.equal(fake.meterRefs(), 0, 'no microphone reference is held');
    assert.equal(h.commits.length, 0, 'nothing was written to the model');
    assert.ok(painted.every((el) => !el.hasAttribute('data-t-mute')), 'the composition was never left muted');
  } finally { h.teardown(); }
});

test('destroying the panel mid-take releases the microphone and writes nothing', async () => {
  const fake = fakeHost();
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const h = mount([clip('a', 0, 3)], 40, AUDIO_KINDS, { host: fake.host, capabilities: ['microphone'] });
  const painted = paintCanvasBoxes(h);
  try {
    const live = takeReaches(h.root, 'recording');
    click(h.root.querySelector('.tl-mic')!);
    await live;
    assert.equal(fake.sessions(), 1, 'precondition: a session is running');

    h.panel.destroy();

    assert.equal(fake.cancels(), 1, 'the session was cancelled, not left running');
    assert.equal(fake.meterRefs(), 0, 'no microphone reference survived the panel');
    assert.ok(painted.every((el) => !el.hasAttribute('data-t-mute')), 'the canvas was handed back unmuted');
    assert.equal(h.commits.length, 0, 'an abandoned take writes nothing');
    await frames(3);
    assert.equal(h.commits.length, 0, 'and still nothing a few frames later');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; }
});

test('pressing the mic through a slow permission prompt never leaves a microphone reference held', async () => {
  // The leak that a phase STRING cannot catch. Press 1 opens the prompt; press 2 abandons
  // that take while the prompt is still up; press 3 starts a fresh one. When the permission
  // finally lands, take 1's continuation resumes and sees a phase of 'countin' - take 3's.
  // Identity, not phase, has to decide, and each continuation may release only the meter
  // reference it took itself: the real meter tears the mic down at refcount 0 ONLY, so a
  // single unbalanced reference keeps the browser's recording indicator lit until reload.
  const fake = fakeHost({ gateMeter: true });
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const h = mount([clip('a', 0, 3)], 40, AUDIO_KINDS, { host: fake.host });
  try {
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;
    click(mic);                       // press 1 - waiting on the prompt
    await frames(1);
    click(mic);                       // press 2 - abandoned mid-prompt
    await frames(1);
    click(mic);                       // press 3 - a new take, same in-flight prompt

    const live = takeReaches(h.root, 'recording');
    fake.grant();
    await live;
    assert.equal(fake.sessions(), 1, 'exactly ONE recorder session - never two at once');

    const done = takeReaches(h.root, 'idle');
    click(mic);
    await done;
    await frames(2);
    assert.equal(fake.meterRefs(), 0, 'every meter reference was balanced - the mic is off');
    assert.equal(h.commits.length, 1, 'and one take landed, not two');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; }
});

test('a re-take abandoned while it saves keeps the OLD recording and commits nothing', async () => {
  // Storing the new take must not delete the take it replaces until the model has been
  // patched: abandon the save in between and the box is left pointing at an asset that no
  // longer exists. Nor may the pending insert land in a panel the user has already closed.
  const fake = fakeHost({ holdUpload: true });
  const clock = fakeClock();
  const countIn = TAKE_TIMING.countInMs;
  TAKE_TIMING.countInMs = 0;
  const existing: Box = {
    id: 'vo', start: 1, dur: 3, lane: '', clipIn: 0, kind: 'audio',
    image: { source: 'user', id: 'user/recording/111.webm', type: 'audio', url: 'blob:old' } as never,
  };
  const h = mount([clip('a', 0, 5), existing], 40, AUDIO_KINDS, { host: fake.host });
  fake.uploads().set('user/recording/111.webm', { type: 'audio' });   // the take already on disk
  try {
    h.select(['vo']);
    const live = takeReaches(h.root, 'recording');
    click(h.root.querySelector('.tl-mic')!);
    await live;
    clock.set(101500);
    click(h.root.querySelector('.tl-mic')!);   // stop → the upload is now held
    await frames(2);

    h.panel.setOpen(false);                    // the user closes the timeline mid-save
    fake.finishUpload();
    await frames(4);

    assert.equal(h.commits.length, 0, 'an abandoned save commits nothing');
    assert.equal(fake.uploads().has('user/recording/111.webm'), true,
      'and the recording it would have replaced is still there');
    assert.equal(fake.meterRefs(), 0, 'no microphone reference survived');
  } finally { h.teardown(); TAKE_TIMING.countInMs = countIn; clock.restore(); }
});

test('a VIDEO in the user/recording namespace is never offered as a take to record over', () => {
  // The record tool and screen capture mint `user/recording/<ts>.mp4` VIDEO assets through
  // the same store. Matching on the id prefix alone would offer to record over one - and
  // the replace path patches the box to an audio ref and deletes the source file.
  const fake = fakeHost();
  const shot: Box = {
    id: 'screen', start: 0, dur: 4, lane: 'seq', clipIn: 0, kind: 'clip',
    image: { source: 'user', id: 'user/recording/222.mp4', type: 'video', url: 'blob:vid' } as never,
  };
  const h = mount([shot], 40, AUDIO_KINDS, { host: fake.host });
  try {
    h.select(['screen']);
    const mic = h.root.querySelector('.tl-mic') as HTMLButtonElement;
    assert.equal(mic.getAttribute('aria-label'), 'Record a voiceover',
      'a screen/camera recording is not one of our takes - recording adds a box, never overwrites it');
  } finally { h.teardown(); }
});

// ── thumbnails: the branch each bar actually takes ────────────────────────────

/**
 * Fill the canvas with the markup each box kind really renders (sequence-studio's
 * hooks.js, verbatim in shape): an audio marker div, a <video>, a Lottie MARKER with
 * its mounted <svg>, a plain <img>, and a card that is nothing but a background.
 * This is what `mediaOf` reads - the panel classifies boxes off the LIVE CANVAS, not
 * off the model, because the hook is what resolved the asset ref to a URL.
 */
function paintMediaBoxes(h: Harness, media: Record<string, string>): void {
  h.canvasEl.setAttribute('data-seq-ms', '10000');
  for (const b of h.boxes) {
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String(b.id));
    el.innerHTML = media[String(b.id)] ?? '';
    h.canvasEl.appendChild(el);
  }
}

interface CtxOp { op: string; args: unknown[] }

/**
 * jsdom has no layout and no 2D context, which is exactly the two things a thumb pass
 * needs. Give every bar a size and every canvas a RECORDING context, so what the pass
 * decided is observable. The drawing itself is still a browser fact - what is asserted
 * here is which branch ran and with what.
 */
async function withThumbStubs(fn: (ops: Map<HTMLCanvasElement, CtxOp[]>) => Promise<void>): Promise<void> {
  const w = dom.window as unknown as {
    Element: { prototype: Element };
    HTMLCanvasElement: { prototype: HTMLCanvasElement };
  };
  const ops = new Map<HTMLCanvasElement, CtxOp[]>();
  const elProto = w.Element.prototype;
  const saved = ['clientWidth', 'clientHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(elProto, k)] as const);
  // Bars only: `tracks.clientWidth` is an own property set by mount() and still wins.
  for (const [k, size] of [['clientWidth', 120], ['clientHeight', 34]] as const) {
    Object.defineProperty(elProto, k, {
      configurable: true,
      get(this: Element) { return this.classList?.contains('tl-clip') ? size : 0; },
    });
  }
  const canvasProto = w.HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const realGetContext = canvasProto.getContext;
  canvasProto.getContext = function (this: HTMLCanvasElement) {
    const log: CtxOp[] = ops.get(this) ?? [];
    ops.set(this, log);
    const rec = (op: string) => (...args: unknown[]): void => { log.push({ op, args }); };
    return {
      scale: rec('scale'), clearRect: rec('clearRect'), fillRect: rec('fillRect'),
      drawImage: rec('drawImage'),
      set fillStyle(v: string) { log.push({ op: 'fillStyle', args: [v] }); },
      get fillStyle() { return '#000'; },
    };
  } as never;
  try {
    // AWAITED inside the try, not returned out of it: a synchronous finally would put
    // the real descriptors back before the deferred pass this exists to observe ran.
    await fn(ops);
  } finally {
    canvasProto.getContext = realGetContext as never;
    for (const [k, desc] of saved) {
      if (desc) Object.defineProperty(elProto, k, desc);
      else delete (elProto as unknown as Record<string, unknown>)[k];
    }
  }
}

const thumbCanvas = (h: Harness, id: string): HTMLCanvasElement =>
  h.root.querySelector(`.tl-clip[data-id="${id}"] canvas.tl-clip-thumbs`) as HTMLCanvasElement;

/** Wait past the thumb pass's idle timeout (onIdle's setTimeout fallback in node). */
const thumbPass = (): Promise<void> => new Promise((r) => setTimeout(r, 120));

test('every clip kind is classified off the live canvas - including a Lottie and a tool clip', async () => {
  const h = mount([clip('img', 0, 1), clip('tool', 1, 1), clip('anim', 2, 1), clip('card', 3, 1), overlay('snd', 0, 2)]);
  try {
    paintMediaBoxes(h, {
      img: '<img class="lolly-box-img" src="https://x.test/photo.png">',
      // A tool clip is a compose render: an ordinary <img> holding a data: URL.
      tool: '<img class="lolly-box-img" src="data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E">',
      // The Lottie MARKER also carries .lolly-box-img - a naive `img.lolly-box-img`
      // lookup misses it (it is a div), which is why it gets its own branch.
      anim: '<div class="lolly-box-img lolly-box-lottie" data-lottie-src="anim.json"><svg viewBox="0 0 100 50"></svg></div>',
      card: '',
      snd: '<div class="lolly-box-audio" data-audio-src="bed.mp3" data-audio-dur="4000"></div>',
    });
    // Force the rebuild that re-reads the canvas (the boxes were painted after mount).
    h.panel.setOpen(false);
    h.panel.setOpen(true);

    assert.equal(h.bar('img').dataset.kind, 'image');
    assert.equal(h.bar('tool').dataset.kind, 'image', 'a tool clip needs no kind of its own');
    assert.equal(h.bar('anim').dataset.kind, 'lottie', 'an animation is no longer an untyped clip');
    assert.equal(h.bar('card').dataset.kind, 'clip', 'no media: the lane kind, as before');
    assert.equal(h.bar('snd').dataset.kind, 'audio');
    // The label follows the same classification.
    assert.equal(h.bar('anim').querySelector('.tl-clip-label')?.textContent, 'Animation');
    assert.equal(h.bar('img').querySelector('.tl-clip-label')?.textContent, 'Image');
  } finally { h.teardown(); }
});

test('a card bar paints its own fill IMMEDIATELY, and an inkless box still paints nothing', async () => {
  // The underlay half of node mode. The fill goes down synchronously, before any await,
  // so a frame bar is never blank while its photograph is being taken - and because the
  // upgrade overwrites the same canvas and `has-thumbs` is only ever ADDED, there is no
  // flash between the two. The photograph itself is the next test; here there is no
  // rasteriser installed and no createImageBitmap, so the capture bails and the
  // underlay is all that ever lands.
  await withThumbStubs(async (ops) => {
    const h = mount([clip('card', 0, 2), clip('ghost', 2, 2)]);
    try {
      paintMediaBoxes(h, { card: '', ghost: '' });
      // The card's fill is the same inline background the box paints on the frame.
      const cardBox = h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement;
      cardBox.style.background = 'rgb(20, 24, 29)';
      h.panel.setOpen(false);
      h.panel.setOpen(true);
      await thumbPass();

      const card = ops.get(thumbCanvas(h, 'card')) ?? [];
      assert.deepEqual(card.filter((o) => o.op === 'fillStyle').map((o) => o.args[0]), ['rgb(20, 24, 29)'],
        'the bar is filled with the box’s own colour, not a made-up one');
      assert.equal(card.some((o) => o.op === 'fillRect'), true);
      assert.equal(h.bar('card').classList.contains('has-thumbs'), true, 'so the label gets its scrim');

      // A box with no media, no fill, no text and no shape is left alone: photographing
      // it would cost a full dom-to-image call to produce a blank bitmap, and an
      // invisible rectangle must not claim has-thumbs (which would dress the label in a
      // scrim over nothing).
      assert.equal(ops.has(thumbCanvas(h, 'ghost')), false, 'no context was even asked for');
      assert.equal(h.bar('ghost').classList.contains('has-thumbs'), false);
    } finally { h.teardown(); }
  });
});

/**
 * Node mode end to end, with the dom-to-image shot faked through `_setNodeRasterer`.
 *
 * There is no rasteriser in node at all, so the seam is the only way to reach the
 * branch - what is asserted is the panel's USE of it (which bars ask, how many, when it
 * re-asks, what happens when it fails), never what the picture looks like.
 *
 * `createImageBitmap` is the other platform piece jsdom lacks: `captureNode` bails
 * before it even looks at the rasterer without one.
 */
async function withNodeRaster(
  shot: (el: HTMLElement, targetH: number) => Promise<{ width: number; height: number } | null>,
  fn: (calls: string[]) => Promise<void>,
): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const hadCib = Object.hasOwn(g, 'createImageBitmap');
  const prevCib = g.createImageBitmap;
  g.createImageBitmap = async (cv: { width: number; height: number }) => ({ width: cv.width, height: cv.height, close(): void { /* fake */ } });
  const calls: string[] = [];
  _setNodeRasterer(async (el, targetH) => {
    calls.push(String((el as HTMLElement).getAttribute?.('data-box-id') ?? ''));
    return (await shot(el as HTMLElement, targetH)) as HTMLCanvasElement | null;
  });
  // The LRU is module-global and node rasters are keyed by APPEARANCE, not by id - two
  // tests with identically-shaped boxes would otherwise share a cached picture.
  clearClipThumbCache();
  try {
    await fn(calls);
  } finally {
    _setNodeRasterer(null);
    clearClipThumbCache();
    if (hadCib) g.createImageBitmap = prevCib; else delete g.createImageBitmap;
  }
}

/** A fake shot: a landscape canvas twice as wide as the requested bar height. */
const okShot = async (_el: HTMLElement, targetH: number): Promise<{ width: number; height: number }> =>
  ({ width: targetH * 2, height: targetH });

test('a frame bar upgrades from its fill to a photograph of the box', async () => {
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async (ops) => {
      const h = mount([clip('card', 0, 2)]);
      try {
        paintMediaBoxes(h, { card: '' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(20, 24, 29)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();                     // the shot is async; let it land

        const card = ops.get(thumbCanvas(h, 'card')) ?? [];
        assert.deepEqual(calls, ['card'], 'the box itself was photographed, not the bar');
        assert.equal(card.some((o) => o.op === 'fillRect'), true, 'the underlay went down first');
        // ONCE, at the leading edge, at its own aspect - never tiled (plans/104 section 8's
        // M2.5 revision, point 4). A filmstrip repeats because it is a picture of time
        // passing; a photograph of a card is identical in every tile, so a wide bar read
        // as the same 6px thumbnail printed twenty times. The fill carries the rest.
        const draws = card.filter((o) => o.op === 'drawImage');
        assert.deepEqual(draws.map((o) => o.args.slice(1)), [[0, 0, 68, 34]]);
        // And the fill is re-laid underneath it in the SAME pass: `clearRect` is what
        // makes the upgrade flicker-free, and it takes the earlier underlay with it.
        assert.equal(card.filter((o) => o.op === 'fillRect').length, 2,
          'the underlay pass, then the fill drawn again beside the single picture');
        assert.equal(h.bar('card').classList.contains('has-thumbs'), true);
      } finally { h.teardown(); }
    });
  });
});

test('a bar NARROWER than one tile draws the WHOLE tile - the raster and its vector twin agree', async () => {
  // The preview-authenticity rule: a vector twin is what the user was actually looking
  // at. The twin sizes the walk to the full `tile` (preserveAspectRatio="none") and then
  // CLIPS it at `min(tile, w)`, exactly as `drawTiled` has always let the canvas edge cut
  // the last tile. A 5-arg `drawImage(bm, 0, 0, min(tile, w), h)` here SCALES instead, so
  // a short clip - or any clip at low zoom - showed a squeezed whole thumbnail on screen
  // against an undistorted left slice in the exported SVG.
  await withNodeRaster(okShot, async () => {
    await withThumbStubs(async (ops) => {
      const h = mount([clip('card', 0, 2)]);
      try {
        paintMediaBoxes(h, { card: '' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(9, 40, 60)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        // 20px of bar against a 68px tile. An OWN property, so it beats withThumbStubs'
        // prototype getter for this one bar (the same trick mount() uses for `tracks`).
        Object.defineProperty(h.bar('card'), 'clientWidth', { value: 20, configurable: true });
        await thumbPass();
        await thumbPass();

        const draws = (ops.get(thumbCanvas(h, 'card')) ?? []).filter((o) => o.op === 'drawImage');
        assert.deepEqual(draws.map((o) => o.args.slice(1)), [[0, 0, 68, 34]],
          'the full tile, cut by the canvas edge - never squeezed into the bar width');
      } finally { h.teardown(); }
    });
  });
});

test('a TRANSPARENT text box and a pen shape get pictures - before this they painted nothing', async () => {
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async (ops) => {
      // Rows that differ in APPEARANCE, not just in id: the signature deliberately
      // leaves the id out, so two boxes that look identical share one shot (and one
      // cache entry) - which is right, but would hide the second bar here.
      const h = mount([
        { ...clip('words', 0, 2), text: 'Chapter one' },
        { ...clip('shape', 2, 2), kind: 'path', d: 'M0 0 L10 10' },
      ]);
      try {
        // No background on either: a text box's default fill is '' and hooks.js FORCES
        // every kind:'path' box to fill:'transparent'. Both used to reach 'none'.
        paintMediaBoxes(h, {
          words: '<div class="lolly-box-text">Chapter one</div>',
          shape: '<svg class="lolly-box-path"><path d="M0 0 L10 10"/></svg>',
        });
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();

        assert.deepEqual(calls.slice().sort(), ['shape', 'words']);
        for (const id of ['words', 'shape']) {
          const log = ops.get(thumbCanvas(h, id)) ?? [];
          assert.equal(log.some((o) => o.op === 'fillRect'), false, `${id}: nothing to underlay - it is transparent`);
          assert.equal(log.some((o) => o.op === 'drawImage'), true, `${id}: got a picture`);
          assert.equal(h.bar(id).classList.contains('has-thumbs'), true, `${id}: scrim`);
        }
      } finally { h.teardown(); }
    });
  });
});

test('a failed photograph leaves the underlay standing rather than blanking the bar', async () => {
  await withNodeRaster(async () => null, async (calls) => {
    await withThumbStubs(async (ops) => {
      const h = mount([clip('card', 0, 2), clip('words', 2, 2)]);
      try {
        paintMediaBoxes(h, { card: '', words: '<div class="lolly-box-text">Chapter one</div>' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(20, 24, 29)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();

        assert.equal(calls.length > 0, true, 'it did try');
        const card = ops.get(thumbCanvas(h, 'card')) ?? [];
        assert.deepEqual(card.filter((o) => o.op === 'fillStyle').map((o) => o.args[0]), ['rgb(20, 24, 29)']);
        assert.equal(card.some((o) => o.op === 'drawImage'), false, 'no picture, but the fill survived');
        assert.equal(h.bar('card').classList.contains('has-thumbs'), true);
        // The transparent one has nothing to fall back TO, so it stays undressed - a
        // scrim over an empty canvas would be worse than no scrim.
        assert.equal(h.bar('words').classList.contains('has-thumbs'), false);
      } finally { h.teardown(); }
    });
  });
});

test('a crowded timeline is bounded: the pass budget refuses to queue one shot per bar', async () => {
  // The stall this prevents: sixty frames × one uncancellable dom-to-image call each,
  // serialised behind one lock. Only MAX_NODE_RASTERS_PER_PASS misses are started per
  // pass, and at most MAX_THUMB_PASSES passes chain, so one scheduling can never spend
  // more than the product - the row past that keeps its fill until the next gesture.
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      // Each box must LOOK different, or the shared-run dedup would collapse sixty
      // asks into one shot and prove nothing about the budget.
      const many = Array.from({ length: 60 }, (_, i) => ({ ...clip(`f${i}`, i, 1), bg: `rgb(1, 2, ${i})` }));
      const h = mount(many);
      try {
        paintMediaBoxes(h, {});
        for (let i = 0; i < 60; i++) {
          (h.canvasEl.querySelector(`[data-box-id="f${i}"]`) as HTMLElement).style.background = `rgb(1, 2, ${i})`;
        }
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        for (let i = 0; i < 12; i++) await thumbPass();   // well past every chained pass

        assert.ok(calls.length > 0, 'some frames did get pictures');
        assert.ok(calls.length <= MAX_NODE_RASTERS_PER_PASS * MAX_THUMB_PASSES,
          `bounded work: ${calls.length} shots for 60 bars`);
        assert.ok(calls.length < 60, 'a sixty-frame row never queues sixty shots');
        assert.equal(new Set(calls).size, calls.length, 'and never the same box twice');
      } finally { h.teardown(); }
    });
  });
});

test('a twenty-frame row CONVERGES: every bar is photographed, once, without a gesture', async () => {
  // The other half of the bound, and the one that was broken. Two compounding bugs made
  // a twenty-frame row give up part-finished: the chain capped at 3 passes × 6 = 18
  // shots, and - worse - a continuation pass counted bars whose shot was still IN
  // FLIGHT as misses, so it re-spent its whole budget on them and the bars it was
  // queued to reach were skipped again, pass after pass. Nothing else re-runs a pass,
  // so those bars stayed blank until the user happened to drag something.
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      const many = Array.from({ length: 20 }, (_, i) => ({ ...clip(`f${i}`, i, 1), bg: `rgb(3, 4, ${i})` }));
      const h = mount(many);
      try {
        paintMediaBoxes(h, {});
        for (let i = 0; i < 20; i++) {
          (h.canvasEl.querySelector(`[data-box-id="f${i}"]`) as HTMLElement).style.background = `rgb(3, 4, ${i})`;
        }
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        for (let i = 0; i < 12; i++) await thumbPass();

        assert.equal(new Set(calls).size, 20, `every frame got its own photograph (${calls.length} shots)`);
        assert.equal(calls.length, 20, 'and none was taken twice');
      } finally { h.teardown(); }
    });
  });
});

test('a box that cannot be photographed is retired, not retried on every pass forever', async () => {
  // A tainted canvas (a cross-origin image with no CORS headers) or a subtree that runs
  // past NODE_RASTER_TIMEOUT_MS comes back with nothing, every time. Before the failure
  // was remembered, the six bars in front spent the whole budget re-learning it on every
  // pass of every scheduling, and the bars behind them were never reached at all.
  const failShot = async (): Promise<null> => null;
  await withNodeRaster(failShot, async (calls) => {
    await withThumbStubs(async () => {
      const h = mount([clip('bad', 0, 2), clip('good', 2, 2)]);
      try {
        paintMediaBoxes(h, { bad: '', good: '' });
        for (const id of ['bad', 'good']) {
          (h.canvasEl.querySelector(`[data-box-id="${id}"]`) as HTMLElement).style.background = 'rgb(9, 9, 9)';
        }
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        for (let i = 0; i < 6; i++) await thumbPass();
        const first = calls.length;
        assert.ok(first > 0 && first <= 2, `one attempt per bar, not per pass (${first})`);

        // A fresh scheduling (what any drag, zoom or fit does) must not re-open it.
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        for (let i = 0; i < 4; i++) await thumbPass();
        assert.equal(calls.length, first, 'a hopeless bar costs exactly one shot, ever');
      } finally { h.teardown(); }
    });
  });
});

test('editing a card’s text re-photographs its bar - a stale picture would LIE about the box', async () => {
  // `tracksKey` is id/lane/timed only, so a text or colour edit took the restyle branch
  // and never re-ran a thumb pass: the bar went on showing a photograph of the old
  // words indefinitely. Timing is excluded from the appearance key on purpose, so this
  // must NOT fire for a drag - the case below.
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      const h = mount([{ ...clip('card', 0, 2), text: 'Chapter one' }]);
      try {
        paintMediaBoxes(h, { card: '<div class="lolly-box-text">Chapter one</div>' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(20, 24, 29)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        assert.equal(calls.length, 1);

        // A drag: the model row's timing moved, its appearance did not.
        h.boxes[0]!.start = 1;
        h.notify();
        await frames(2);
        await thumbPass();
        assert.equal(calls.length, 1, 'a drag re-uses the picture it already has');

        // The sidebar edit.
        h.boxes[0]!.text = 'Chapter two';
        h.notify();
        await frames(2);
        await thumbPass();
        assert.equal(calls.length, 2, 'new words, new photograph');
      } finally { h.teardown(); }
    });
  });
});

test('a second pass reuses the cached photograph, and a DRAG does not invalidate it', async () => {
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      const h = mount([clip('card', 0, 2)]);
      try {
        paintMediaBoxes(h, { card: '' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(20, 24, 29)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.equal(calls.length, 1);

        // An unchanged rebuild: the LRU answers, no shot.
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.equal(calls.length, 1, 'the cache served it');

        // A drag rewrites start/dur on the row. The picture has not changed one pixel,
        // and re-shooting every bar a ripple touched is exactly what appearanceSig
        // exists to prevent.
        h.boxes[0]!.start = 5;
        h.boxes[0]!.dur = 3;
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.equal(calls.length, 1, 'moving a clip is not a new picture');

        // Recolouring the box IS a new picture.
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(90, 10, 10)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.equal(calls.length, 2, 'a repaint of the box is a repaint of the bar');
      } finally { h.teardown(); }
    });
  });
});

test('a gesture aborts a queued pass before a single photograph is taken', async () => {
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      const h = mount([clip('card', 0, 2)]);
      try {
        paintMediaBoxes(h, { card: '' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(9, 9, 9)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        h.bar('card').dispatchEvent(pointer('pointerdown', 40 + EDGE_PX + 4));
        await thumbPass();
        assert.deepEqual(calls, [], 'a drag must never compete with a dom-to-image shot');

        h.root.dispatchEvent(pointer('pointerup', 40 + EDGE_PX + 4));
        await thumbPass();
        await thumbPass();
        assert.deepEqual(calls, ['card'], 'and the pass after the gesture does take it');
      } finally { h.teardown(); }
    });
  });
});

test('an export suspends node rasters entirely, and caches nothing while it holds them', async () => {
  // dom-to-image-more keeps MODULE-GLOBAL options / url cache / sandbox iframe and
  // clears them at the end of ANY call, so a thumbnail shot overlapping an export
  // corrupts both pictures. Nothing is cached while suspended either, or the bar would
  // remember the blank forever.
  const { suspendNodeRasters } = await import('../lib/clip-thumbs.ts');
  await withNodeRaster(okShot, async (calls) => {
    await withThumbStubs(async () => {
      const h = mount([clip('card', 0, 2)]);
      const release = suspendNodeRasters();
      try {
        paintMediaBoxes(h, { card: '' });
        (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(20, 24, 29)';
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.deepEqual(calls, [], 'the export owns the rasteriser');

        release();
        h.panel.setOpen(false);
        h.panel.setOpen(true);
        await thumbPass();
        await thumbPass();
        assert.deepEqual(calls, ['card'], 'and the bar retries once it is free');
      } finally { release(); h.teardown(); }
    });
  });
});

test('a thumb pass is idle-scheduled and a gesture aborts it before anything paints', async () => {
  await withThumbStubs(async (ops) => {
    const h = mount([clip('card', 0, 2)]);
    try {
      paintMediaBoxes(h, { card: '' });
      (h.canvasEl.querySelector('[data-box-id="card"]') as HTMLElement).style.background = 'rgb(9, 9, 9)';
      h.panel.setOpen(false);
      h.panel.setOpen(true);
      // Nothing has painted yet: the pass is deferred, never run inside the rebuild.
      assert.equal(ops.size, 0, 'the pass waits for an idle moment');

      // A drag begins. abortThumbs() runs on pointerdown, so the queued pass is dropped
      // rather than competing with the gesture for the main thread.
      const el = h.bar('card');
      el.dispatchEvent(pointer('pointerdown', 40 + EDGE_PX + 4));
      await thumbPass();
      assert.equal(ops.size, 0, 'the aborted pass never touched a canvas');

      // Releasing schedules a fresh pass, which does paint.
      h.root.dispatchEvent(pointer('pointerup', 40 + EDGE_PX + 4));
      await thumbPass();
      assert.equal(ops.size, 1, 'the pass after the gesture runs');
      assert.equal(h.bar('card').classList.contains('has-thumbs'), true);
    } finally { h.teardown(); }
  });
});

test('an image bar TILES one still across its width rather than stretching it', async () => {
  await withThumbStubs(async (ops) => {
    // A decoded picture and a bitmap factory - the two platform pieces jsdom lacks. The
    // TILING is the panel's own arithmetic, and that is what is asserted.
    const g = globalThis as Record<string, unknown>;
    const hadCib = Object.hasOwn(g, 'createImageBitmap');
    const prevCib = g.createImageBitmap;
    g.createImageBitmap = async (cv: HTMLCanvasElement) => ({ width: cv.width, height: cv.height, close(): void { /* fake */ } });
    const h = mount([clip('shot', 0, 3)]);
    try {
      paintMediaBoxes(h, { shot: '<img class="lolly-box-img" src="https://x.test/tiled-still.png">' });
      const img = h.canvasEl.querySelector('img') as HTMLImageElement;
      Object.defineProperty(img, 'complete', { value: true });
      Object.defineProperty(img, 'naturalWidth', { value: 100 });
      Object.defineProperty(img, 'naturalHeight', { value: 50 });
      h.panel.setOpen(false);
      h.panel.setOpen(true);
      await thumbPass();
      await thumbPass();                       // the capture is async; let it land

      const bar = thumbCanvas(h, 'shot');
      const draws = (ops.get(bar) ?? []).filter((o) => o.op === 'drawImage');
      // A 100×50 picture at a 34px bar height is a 68px tile, so a 120px bar shows two.
      assert.deepEqual(draws.map((o) => o.args.slice(1)), [[0, 0, 68, 34], [68, 0, 68, 34]],
        'consecutive tiles at the asset’s own aspect - never one stretched thumbnail');
      assert.equal(h.bar('shot').classList.contains('has-thumbs'), true);
    } finally {
      h.teardown();
      if (hadCib) g.createImageBitmap = prevCib; else delete g.createImageBitmap;
    }
  });
});

// ── THE ONE RULE: selecting in the timeline keeps the selection LIVE ──────────
//
// free-canvas.ts's header states it verbatim. The panel owns exactly one half:
// "selecting in the timeline moves the playhead so the selection stays live" - the
// converse (time rewriting the selection) is the Premiere failure and is deliberately
// NOT implemented. `selectAndReveal` is the single writer; every route into a
// selection goes through it, so what is checked below is the behaviour, not a call.
//
// The clock applies a seek on the next frame, so the assertions read the playhead
// element the tick paints rather than reaching into the clock.

// `frames()` (above) is what lets the clock's rAF-coalesced apply pass - and the
// onTick fan-out that paints the playhead - actually run.
const playheadPx = (h: Harness): number =>
  parseFloat((h.root.querySelector('.tl-playhead') as HTMLElement).style.left || '0');

test('clicking a clip the playhead is NOT inside moves the playhead to it, once', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    assert.equal(playheadPx(h), 0, 'precondition: the playhead is at 0s, inside clip a');
    h.selSets.length = 0;

    const el = h.bar('b');                       // 3s → 5s, i.e. 120px → 200px
    el.dispatchEvent(pointer('pointerdown', 120 + EDGE_PX + 4));
    h.root.dispatchEvent(pointer('pointerup', 120 + EDGE_PX + 4));
    await frames(3);

    assert.deepEqual(h.selSets, [['b']], 'the selection was written exactly once');
    assert.equal(playheadPx(h), 120, 'and the picture moved to the top of clip b (3s × 40px/s)');
    assert.equal(h.commits.length, 0, 'revealing is not an edit - nothing reached the model');
  } finally { h.teardown(); }
});

test('clicking a clip the playhead is ALREADY inside costs no seek at all', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', EDGE_PX + 4));
    h.root.dispatchEvent(pointer('pointerup', EDGE_PX + 4));
    await frames(3);
    assert.equal(playheadPx(h), 0, 'the commonest case by far, and it moves nothing');
  } finally { h.teardown(); }
});

test('while PLAYING, selecting a clip never yanks the playhead - that would be a jump cut', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    // The clock refuses to play an untimed canvas (it reads its length off the live
    // DOM, not off the model), so give the artboard the length the tool hook stamps.
    h.canvasEl.setAttribute('data-seq-ms', '5000');
    (h.root.querySelector('.tl-play') as HTMLElement).click();   // clock.play()
    await frames(3);
    const at = playheadPx(h);

    const el = h.bar('b');
    el.dispatchEvent(pointer('pointerdown', 120 + EDGE_PX + 4));
    h.root.dispatchEvent(pointer('pointerup', 120 + EDGE_PX + 4));
    await frames(3);

    assert.deepEqual(h.selSets.at(-1), ['b'], 'the selection still followed the press');
    assert.ok(playheadPx(h) >= at && playheadPx(h) < 120,
      `the playhead kept running from ${at}px instead of jumping to 120px (was ${playheadPx(h)}px)`);
  } finally {
    (h.root.querySelector('.tl-play') as HTMLElement).click();   // stop the rAF loop
    h.teardown();
  }
});

test('Shift-extending a selection does not seek - there is no single clip to reveal', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    const a = h.bar('a');
    a.dispatchEvent(pointer('pointerdown', EDGE_PX + 4));
    h.root.dispatchEvent(pointer('pointerup', EDGE_PX + 4));
    await frames(3);
    assert.equal(playheadPx(h), 0);

    const b = h.bar('b');
    b.dispatchEvent(pointer('pointerdown', 120 + EDGE_PX + 4, { shiftKey: true }));
    h.root.dispatchEvent(pointer('pointerup', 120 + EDGE_PX + 4, { shiftKey: true }));
    await frames(3);

    assert.deepEqual(h.selSets.at(-1), ['a', 'b'], 'both clips are selected');
    assert.equal(playheadPx(h), 0, 'and the picture stayed under the FIRST of them');
  } finally { h.teardown(); }
});

// ── the `tl-time` seam: an ACTIVE-SET change, never a tick ────────────────────

test('tl-time fires when the active set changes and stays silent inside one clip', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    const seen: Array<{ atMs: number; activeIds: string[]; playing: boolean }> = [];
    h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });

    // Four seeks, all inside clip a. `fc-seek` is the canvas→panel half of the seam,
    // so this drives the panel exactly as the off-playhead banner's button does.
    for (const atMs of [400, 900, 1500, 2900]) {
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs } }));
      await frames(3);
    }
    assert.equal(seen.length, 0, 'sixty ticks a second inside one clip must not repaint the canvas');
    assert.equal(playheadPx(h), 2.9 * 40, '…but the playhead really did move');

    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
    await frames(3);
    assert.equal(seen.length, 1, 'crossing the cut fires exactly once');
    assert.deepEqual(seen[0]!.activeIds, ['b']);
    assert.equal(seen[0]!.atMs, 3500);
    assert.equal(seen[0]!.playing, false);
  } finally { h.teardown(); }
});

test('a junk fc-seek detail seeks to zero rather than to NaN', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
    await frames(3);
    assert.equal(playheadPx(h), 140);
    for (const detail of [{ atMs: 'soon' }, { atMs: Number.NaN }, { atMs: -5 }, null]) {
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail }));
      await frames(3);
      assert.equal(playheadPx(h), 0, `detail ${JSON.stringify(detail)} landed at 0`);
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
      await frames(3);
    }
  } finally { h.teardown(); }
});

test('destroying the panel takes the fc-seek listener with it', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  await frames(3);
  const stage = h.stageEl;
  h.teardown();
  // No clock, no listener: this must be inert rather than throw on a dead clock.
  stage.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 1000 } }));
});

// ── TRIM v2: bigger targets, three states, a limit signal, ripple and a readout ──
//
// The arithmetic is timeline-math's and is unit-tested at the repo root (trimClip,
// edgeZonePx, fmtDur, fmtDelta). What is pinned HERE is the wiring only the panel can
// get wrong: which pointer gets which hit zone, that the LIMIT signal reads the
// writer's own answer rather than a second copy of the clamp, that the readout says
// what actually landed, that the ripple is live rather than deferred to release - and
// that none of it broke "the model is written exactly once per gesture".
//
// Every mounted row set below totals FIVE seconds, because that is the length `mount`
// fits its 224px viewport to in order to land on exactly 40px per second.

test('the trim hit zone follows the POINTER: 20px in is a trim by finger, a move by mouse', async () => {
  // A 2s overlay at 40px/s spans 40px → 120px. The press is 20px inside its left edge:
  // outside the 10px cursor zone, well inside the 24px touch zone.
  for (const [pointerType, wantDur] of [['touch', 1], ['mouse', 2]] as const) {
    const h = mount([clip('a', 0, 5), overlay('o', 1, 2)]);
    try {
      const el = h.bar('o');
      el.dispatchEvent(pointer('pointerdown', 60, { pointerType }));
      h.root.dispatchEvent(pointer('pointermove', 100, { pointerType }));
      await frames(3);
      h.root.dispatchEvent(pointer('pointerup', 100, { pointerType, altKey: true }));

      assert.equal(h.commits.length, 1, `${pointerType}: exactly one write`);
      const o = h.commits[0]!.find((b) => b.id === 'o')!;
      assert.equal(Number(o.start), 2, `${pointerType}: the in point moved a second either way`);
      assert.equal(Number(o.dur), wantDur, pointerType === 'touch'
        ? 'a finger 20px in grabbed the EDGE, so the clip got shorter'
        : 'a cursor 20px in grabbed the BODY, so the clip only moved');
    } finally { h.teardown(); }
  }
});

test('a bar too narrow to carry two zones offers none - and says where to trim instead', () => {
  // 0.5s at 40px/s = 20px, under MIN_TRIM_BAR_PX. Pressing its very first pixel must
  // still be a grab, or the clip could never be moved again at this zoom.
  const h = mount([clip('a', 0, 5), overlay('o', 1, 0.5)]);
  try {
    const el = h.bar('o');
    assert.ok(el.classList.contains('is-tight'), 'the bar is marked, so the CSS can drop the grips');
    assert.match(el.title, /too narrow to trim/, 'and its title points at the precise route');
    el.dispatchEvent(pointer('pointerdown', 40));
    h.root.dispatchEvent(pointer('pointermove', 80));
    h.root.dispatchEvent(pointer('pointerup', 80, { altKey: true }));
    const o = h.commits[0]!.find((b) => b.id === 'o')!;
    assert.equal(Number(o.dur), 0.5, 'the length is untouched: that press was a move, not a trim');
    assert.equal(Number(o.start), 2);
    assert.equal(h.bar('a').classList.contains('is-tight'), false, 'a normal bar is not marked');
  } finally { h.teardown(); }
});

test('dragging past the end of the source flags the LIMIT and commits the clamped value', async () => {
  const h = mount([clip('a', 0, 5), overlay('o', 0, 2)]);
  try {
    // A 3-second source behind a 2-second clip: exactly 1s of headroom, then the wall.
    paintMediaBoxes(h, { o: '<div class="lolly-box-audio" data-audio-src="vo.mp3" data-audio-dur="3000"></div>' });
    const el = h.bar('o');
    const outEdge = el.querySelector('.tl-edge[data-edge="out"]') as HTMLElement;

    el.dispatchEvent(pointer('pointerdown', 78));          // within 10px of the 80px right edge
    assert.ok(el.classList.contains('is-trimming'), 'the clip announces the mode');
    assert.ok(outEdge.classList.contains('is-active'), 'and the edge under the pointer lights up');
    assert.equal(outEdge.classList.contains('is-limit'), false, 'nothing has been refused yet');

    h.root.dispatchEvent(pointer('pointermove', 158));     // +80px = +2s, i.e. 1s past the source
    await frames(3);
    assert.ok(outEdge.classList.contains('is-limit'), 'the writer refused, so the edge says so');

    h.root.dispatchEvent(pointer('pointerup', 158, { altKey: true }));
    assert.equal(h.commits.length, 1, 'still exactly one write');
    assert.equal(Number(h.commits[0]!.find((b) => b.id === 'o')!.dur), 3, 'clamped to the media, not to the drag');
    assert.equal(el.classList.contains('is-trimming'), false, 'and every trim state comes off on release');
    assert.equal(outEdge.classList.contains('is-limit'), false);
    assert.equal(outEdge.classList.contains('is-active'), false);
    assert.equal((h.root.querySelector('.tl-trim-badge') as HTMLElement).hidden, true);
    assert.equal((h.root.querySelector('.tl-clip-extent') as HTMLElement).hidden, true);
  } finally { h.teardown(); }
});

test('a SUCCESSFUL trim-in on the magnetic row is not mistaken for a limit', async () => {
  // The seq row repacks gapless from 0, so a trim-in leaves `start` exactly where it
  // was and takes the frame off the LENGTH instead. Comparing the edge's absolute time
  // against the request would therefore report "end of the source" on every trim-in
  // that worked - which is why the limit test compares durations.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    const inEdge = el.querySelector('.tl-edge[data-edge="in"]') as HTMLElement;
    el.dispatchEvent(pointer('pointerdown', 2));                          // a's in edge
    h.root.dispatchEvent(pointer('pointermove', 42, { altKey: true }));   // +40px = +1s
    await frames(3);
    assert.equal(inEdge.classList.contains('is-limit'), false, 'the writer said yes, so no limit');
    assert.equal(el.style.width, '80px', 'and the clip really did lose a second');
    h.root.dispatchEvent(pointer('pointerup', 42, { altKey: true }));
    const a = h.commits[0]!.find((x) => x.id === 'a')!;
    assert.equal(Number(a.dur), 2);
    assert.equal(Number(a.start), 0, 'the magnetic row pinned the start, exactly as designed');
    assert.equal(Number(a.clipIn), 1, 'the second came off the source instead');
  } finally { h.teardown(); }
});

test('the trim badge reads the ACHIEVED duration and a signed delta', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const badge = h.root.querySelector('.tl-trim-badge') as HTMLElement;
    assert.equal(badge.hidden, true, 'invisible until a trim starts');
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', 118));                        // a's out edge (3s = 120px)
    assert.equal(badge.hidden, false);
    h.root.dispatchEvent(pointer('pointermove', 78, { altKey: true }));   // -40px = -1s
    await frames(3);
    assert.equal(badge.textContent, `${fmtDur(2)}  ${fmtDelta(-1)}`);
    assert.equal(badge.textContent, '2.0s  -1.0s', 'and that is what it literally says');
    assert.equal(h.commits.length, 0, 'a readout is not a write');
    h.root.dispatchEvent(pointer('pointerup', 78, { altKey: true }));
    assert.equal(badge.hidden, true);
  } finally { h.teardown(); }
});

test('a seq trim RIPPLES live: the downstream bar moves during the drag, not on release', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const a = h.bar('a');
    const b = h.bar('b');
    assert.equal(b.style.left, '120px', 'precondition: b starts where a ends');
    a.dispatchEvent(pointer('pointerdown', 118));
    h.root.dispatchEvent(pointer('pointermove', 78, { altKey: true }));
    await frames(3);
    assert.equal(b.style.left, '80px', 'b followed a’s new out point mid-drag');
    assert.equal(h.commits.length, 0, 'and the model has still not been touched');
    h.root.dispatchEvent(pointer('pointerup', 78, { altKey: true }));
    assert.equal(h.commits.length, 1);
    assert.equal(Number(h.commits[0]!.find((x) => x.id === 'b')!.start), 2, 'the commit agrees with the preview');
  } finally { h.teardown(); }
});

test('a trim drag on one edge of a MULTI-selection trims every selected clip - one write', async () => {
  // Everything ends by 5s so the fitted zoom is the 40px/s the bar rects are laid out at.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 2), overlay('p', 3.5, 1)]);
  try {
    // Marquee-style selection of three clips, then a press on a's out edge (3s = 120px).
    // A plain press on a member of a multi-selection keeps the set, so the trim is the
    // group's - "drag from the edges to shrink or grow the whole group's duration".
    h.select(['a', 'b', 'o']);
    const a = h.bar('a');
    const b = h.bar('b');
    const o = h.bar('o');
    a.dispatchEvent(pointer('pointerdown', 118));
    assert.ok(a.classList.contains('is-trimming'), 'the pressed bar carries the trim chrome');
    assert.equal(b.classList.contains('is-trimming'), false, 'the others do not - one badge, one ghost');
    h.root.dispatchEvent(pointer('pointermove', 78, { altKey: true }));   // -40px = -1s
    await frames(3);
    assert.equal(a.style.width, '80px', 'a previews 1s shorter');
    assert.equal(b.style.width, '40px', 'b too - same edge, same delta');
    assert.equal(o.style.width, '40px', 'and the selected overlay');
    assert.equal(b.style.left, '80px', 'the row repacked behind a mid-drag');
    assert.equal(h.commits.length, 0, 'a preview is not a write');

    h.root.dispatchEvent(pointer('pointerup', 78, { altKey: true }));
    assert.equal(h.commits.length, 1, 'EXACTLY one write for the whole batch');
    const rows = h.commits[0]!;
    const dur = (id: string): number => Number(rows.find((x) => x.id === id)!.dur);
    assert.equal(dur('a'), 2);
    assert.equal(dur('b'), 1);
    assert.equal(dur('o'), 1);
    assert.equal(dur('p'), 1, 'not selected, so untouched');
    assert.equal(Number(rows.find((x) => x.id === 'b')!.start), 2, 'the commit agrees with the preview');
    assert.equal(a.classList.contains('is-trimming'), false, 'every trim state comes off on release');
  } finally { h.teardown(); }
});

test('a batch trim clamps PER CLIP - the one that hits its source stops, the rest continue', async () => {
  const h = mount([clip('a', 0, 5), overlay('o', 0, 2), overlay('p', 3, 1)]);
  try {
    // o has exactly 1s of headroom (a 3s source); p is a card with no source.
    paintMediaBoxes(h, { o: '<div class="lolly-box-audio" data-audio-src="vo.mp3" data-audio-dur="3000"></div>' });
    h.select(['o', 'p']);
    const o = h.bar('o');
    o.dispatchEvent(pointer('pointerdown', 78));                          // o's out edge (2s = 80px)
    h.root.dispatchEvent(pointer('pointermove', 158, { altKey: true }));  // +80px = +2s
    await frames(3);
    h.root.dispatchEvent(pointer('pointerup', 158, { altKey: true }));
    assert.equal(h.commits.length, 1);
    const rows = h.commits[0]!;
    assert.equal(Number(rows.find((x) => x.id === 'o')!.dur), 3, 'held at the end of its file');
    assert.equal(Number(rows.find((x) => x.id === 'p')!.dur), 3, 'took the whole +2s');
  } finally { h.teardown(); }
});

/** Arm the panel's keyboard the way a pointer would: hover the panel, focus a bar. */
function armKeys(h: Harness, id: string, atPx: number): HTMLElement {
  h.root.dispatchEvent(new dom.window.Event('pointerenter'));
  const el = h.bar(id);
  el.dispatchEvent(pointer('pointerdown', atPx));
  h.root.dispatchEvent(pointer('pointerup', atPx));
  el.focus();
  h.commits.length = 0;
  return el;
}
const press = (el: HTMLElement, key: string, extra: Record<string, unknown> = {}): void => {
  el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
};

test('keyboard trim: `[` / `]` arm an edge and `,` / `.` walk it ONE frame, one write each', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = armKeys(h, 'a', 60);
    press(el, '[');
    assert.ok((el.querySelector('.tl-edge[data-edge="in"]') as HTMLElement).classList.contains('is-active'),
      'the in edge is armed, and visibly so');

    press(el, '.');
    assert.equal(h.commits.length, 1, 'exactly one write per press');
    // One frame at 30fps off the IN edge. The seq row is magnetic, so `start` stays 0
    // and the frame comes off the LENGTH; the source in-point takes it instead.
    const a1 = h.commits[0]!.find((x) => x.id === 'a')!;
    assert.equal(Number(a1.dur), 2.967);
    assert.equal(Number(a1.clipIn), 0.033, 'a trim-in consumed a frame of the source');
    assert.equal(Number(a1.start), 0, 'the magnetic row still starts at zero');
    assert.equal(Number(h.commits[0]!.find((x) => x.id === 'b')!.start), 2.967, 'and b rippled with it');

    press(el, ']');
    assert.ok((el.querySelector('.tl-edge[data-edge="out"]') as HTMLElement).classList.contains('is-active'));
    assert.equal((el.querySelector('.tl-edge[data-edge="in"]') as HTMLElement).classList.contains('is-active'), false,
      'only one edge is ever armed');

    press(el, ',');
    assert.equal(h.commits.length, 2);
    assert.equal(Number(h.commits[1]!.find((x) => x.id === 'a')!.dur), 2.934, 'the out edge came back a frame');

    press(el, '.', { shiftKey: true });
    assert.equal(h.commits.length, 3, 'Shift is ten frames - still one write');
    assert.equal(Number(h.commits[2]!.find((x) => x.id === 'a')!.dur), 3.267);
  } finally { h.teardown(); }
});

test('keyboard trim with several clips selected walks that edge on all of them', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 1, 2)]);
  try {
    const el = armKeys(h, 'a', 60);
    h.select(['a', 'b', 'o']);
    press(el, ']');
    press(el, ',');                                            // one frame earlier on every out edge
    assert.equal(h.commits.length, 1, 'one write for the batch');
    const rows = h.commits[0]!;
    for (const id of ['a', 'b', 'o']) {
      const before = id === 'b' || id === 'o' ? 2 : 3;
      assert.equal(Number(rows.find((x) => x.id === id)!.dur), Math.round((before - 1 / 30) * 1000) / 1000, `${id} lost a frame`);
    }
  } finally { h.teardown(); }
});

test('keyboard trim: `e` pulls the armed edge to the playhead; with nothing armed it writes nothing', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(3);
    const el = armKeys(h, 'a', 60);
    press(el, 'e');
    assert.equal(h.commits.length, 0, 'no edge is armed, so there is nothing to trim');

    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 2000 } }));
    await frames(3);
    press(el, ']');
    press(el, 'e');
    assert.equal(h.commits.length, 1);
    assert.equal(Number(h.commits[0]!.find((x) => x.id === 'a')!.dur), 2, 'the out edge landed on the playhead');
  } finally { h.teardown(); }
});

test('Escape unarms the trim edge BEFORE it closes the panel', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = armKeys(h, 'a', 60);
    press(el, ']');
    const outEdge = el.querySelector('.tl-edge[data-edge="out"]') as HTMLElement;
    assert.ok(outEdge.classList.contains('is-active'));

    press(el, 'Escape');
    assert.equal(outEdge.classList.contains('is-active'), false, 'the first Escape unarmed the edge');
    assert.equal(h.panel.isOpen(), true, 'and did NOT close the panel out from under it');

    press(el, 'Escape');
    assert.equal(h.panel.isOpen(), false, 'the second Escape closes it, exactly as it always did');
  } finally { h.teardown(); }
});

test('the CSS trim zones are the SAME numbers the hit test uses', () => {
  // The stylesheet has carried a "keep these in step" comment since the panel shipped,
  // with nothing behind it. A hit target wider or narrower than the thing it paints is
  // the exact defect this work item exists to fix, so it is pinned rather than trusted.
  const css = readFileSync(new URL('../styles/parts/timeline.css', import.meta.url), 'utf8');
  // The declaration may be a bare length or edgeZonePx's cap written as min(Npx, 33%);
  // either way the first pixel value in it is the base zone.
  const rest = /\.tl-edge\s*\{[^}]*\bwidth:[^;]*?(\d+)px/.exec(css);
  assert.ok(rest, '.tl-edge declares a width');
  assert.equal(Number(rest![1]), EDGE_PX, `.tl-edge width matches EDGE_PX (${EDGE_PX})`);

  const coarse = /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.tl-edge\s*\{[^}]*\bwidth:[^;]*?(\d+)px/.exec(css);
  assert.ok(coarse, 'the coarse-pointer block overrides .tl-edge');
  assert.equal(Number(coarse![1]), EDGE_PX_COARSE, `the coarse override matches EDGE_PX_COARSE (${EDGE_PX_COARSE})`);

  // Dashed borders in this shell mean "drop area" and nothing else; the reachable-media
  // ghost is not one.
  const extent = /\.tl-clip-extent\s*\{[^}]*\}/.exec(css);
  assert.ok(extent, '.tl-clip-extent is styled');
  assert.ok(!/dashed/.test(extent![0]), 'the reachable-media ghost is a SOLID outline');
});

// ── split v2: scope, boundaries, the through edit and Join ─────────────────────
//
// The whole point of `splitAll` is the UNDO shape: N clips cut at one instant is ONE
// model write, and a cut that lands on an existing edit is ZERO. Both are asserted on
// `commits`, which is the module's actual output.

test('Shift+S splits every clip the playhead is inside, in EXACTLY ONE commit', async () => {
  // Three overlays stacked over the same instant plus a seq clip - four cuts, one write.
  // 5s total, so the harness's stubbed viewport fits to exactly 40px per second and
  // `seekTo` lands on the instant it names.
  const h = mount([clip('a', 0, 5), overlay('o1', 0, 5), overlay('o2', 0, 5)]);
  try {
    await frames(2);
    seekTo(h, 2);
    await frames(2);
    h.commits.length = 0;
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    press(h.root, 'S', { shiftKey: true });
    assert.equal(h.commits.length, 1, 'ONE write for the whole command = ONE undo step');
    const out = h.commits[0]!;
    assert.equal(out.length, 6, 'three clips became six');
    for (const id of ['a', 'o1', 'o2']) assert.equal(Number(out.find((b) => b.id === id)!.dur), 2, `${id} left half`);
    assert.equal(new Set(out.map((b) => String(b.id))).size, 6, 'every minted id is distinct');
  } finally { h.teardown(); }
});

test('a split at an existing cut writes NOTHING - no undo entry for a no-op', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(2);
    // Exactly on the seam between a and b. Nothing here can split (the playhead is on
    // both clips' boundaries), so the command must cost no commit at all.
    seekTo(h, 3);
    await frames(2);
    h.commits.length = 0;
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    press(h.root, 's');
    assert.equal(h.commits.length, 0, 'ZERO commits - the playhead is already at a cut');
    press(h.root, 'S', { shiftKey: true });
    assert.equal(h.commits.length, 0, 'and the same for the split-everything variant');
  } finally { h.teardown(); }
});

test('a plain `s` splits the SELECTION when the playhead is inside it, else the clip under it', async () => {
  const h = mount([clip('a', 0, 5), overlay('o', 0, 5)]);
  try {
    await frames(2);
    seekTo(h, 2);
    await frames(2);
    h.select(['o']);
    h.commits.length = 0;
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    press(h.root, 's');
    assert.equal(h.commits.length, 1);
    assert.equal(h.commits[0]!.length, 3, 'only the SELECTED overlay was cut, not the seq clip too');
    assert.equal(Number(h.commits[0]!.find((b) => b.id === 'o')!.dur), 2);
    assert.equal(Number(h.commits[0]!.find((b) => b.id === 'a')!.dur), 5, 'the seq clip is untouched');
  } finally { h.teardown(); }
});

test('a fresh cut marks the seam as a THROUGH edit, and Join puts the clip back', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    await frames(2);
    seekTo(h, 2);
    await frames(2);
    h.commits.length = 0;
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    press(h.root, 's');
    assert.equal(h.commits.length, 1, 'the cut landed');
    const beforeJoin = h.commits[0]!.map((x) => ({ ...x }));
    h.notify();
    await frames(3);

    const through = Array.from(h.root.querySelectorAll('.tl-seam.is-through'));
    assert.equal(through.length, 1, 'exactly the new cut is drawn as a through edit');
    const newId = String(beforeJoin[1]!.id);
    assert.deepEqual([(through[0] as HTMLElement).dataset.a, (through[0] as HTMLElement).dataset.b], ['a', newId]);

    // Join, from the clip context menu (the one-sided route).
    rightClick(h.bar('a'));
    const join = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim() === 'Join clips');
    assert.ok(join, 'Join is offered on a through edit');
    click(join!);
    assert.equal(h.commits.length, 2, 'ONE more commit');
    assert.deepEqual(
      h.commits[1]!.map((x) => [x.id, x.start, x.dur]),
      [['a', 0, 3], ['b', 3, 2]],
      'the clip is whole again',
    );
  } finally { h.teardown(); }
});

test('Join is NOT offered at a seam that is a real decision', async () => {
  // Two different sources butted together: adjacent, but never one clip.
  const h = mount([
    { id: 'a', start: 0, dur: 2, lane: 'seq', clipIn: 0, speed: 1, image: { id: 'one.mp4' } as never },
    { id: 'b', start: 2, dur: 2, lane: 'seq', clipIn: 0, speed: 1, image: { id: 'two.mp4' } as never },
  ], 40, ADD_KINDS, { assetField: 'image' });
  try {
    await frames(2);
    assert.equal(h.root.querySelectorAll('.tl-seam.is-through').length, 0, 'no hairline on a real cut');
    rightClick(h.bar('a'));
    assert.equal(menuLabels(openMenu('.tl-ctx-menu')).includes('Join clips'), false,
      'and the menu does not offer it either - absent, not greyed out');
  } finally { h.teardown(); }
});

// ── detach / re-attach audio ──────────────────────────────────────────────────

/** Paint a live canvas where `id` is a decoded <video>, so mediaOf() calls it a video. */
function paintVideo(h: Harness, id: string, durSec = 8): void {
  h.canvasEl.setAttribute('data-seq-ms', '10000');
  for (const b of h.boxes) {
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String(b.id));
    if (String(b.id) === id) {
      el.innerHTML = '<video class="lolly-box-video" src="clip.mp4"></video>';
      const v = el.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(v, 'duration', { value: durSec, configurable: true });
    }
    h.canvasEl.appendChild(el);
  }
}

/** Open the context menu on a bar and read the labels the panel put in it. */
function ctxLabels(h: Harness, id: string): string[] {
  rightClick(h.bar(id));
  const out = menuLabels(openMenu('.tl-ctx-menu'));
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return out;
}

test('Detach audio needs BOTH the manifest link field and an audio add-kind', () => {
  // 1. link field declared, audio kind declared, and the box really is a video → offered.
  const yes = mount([clip('v', 0, 4)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    paintVideo(yes, 'v');
    yes.panel.setOpen(false); yes.panel.setOpen(true);
    assert.ok(ctxLabels(yes, 'v').some((l) => l.startsWith('Detach audio')), 'offered');
  } finally { yes.teardown(); }

  // 2. no audio add-kind: there is no vocabulary for a detached sound to be born into.
  const noKind = mount([clip('v', 0, 4)], 40, [{ id: 'clip', label: 'Clip' }], { linkField: 'linkOf' });
  try {
    paintVideo(noKind, 'v');
    noKind.panel.setOpen(false); noKind.panel.setOpen(true);
    assert.equal(ctxLabels(noKind, 'v').some((l) => l.startsWith('Detach audio')), false);
  } finally { noKind.teardown(); }

  // 3. no link field: the tool never opted in, so the feature does not exist here.
  const noField = mount([clip('v', 0, 4)]);
  try {
    paintVideo(noField, 'v');
    noField.panel.setOpen(false); noField.panel.setOpen(true);
    assert.equal(ctxLabels(noField, 'v').some((l) => l.startsWith('Detach audio')), false);
  } finally { noField.teardown(); }

  // 4. link field, audio kind - but the box has no video to take a sound off.
  const noVideo = mount([clip('card', 0, 4)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    assert.equal(ctxLabels(noVideo, 'card').some((l) => l.startsWith('Detach audio')), false);
  } finally { noVideo.teardown(); }
});

test('detach then re-attach returns the model to its pre-detach shape', async () => {
  const h = mount([clip('v', 0, 4), clip('w', 4, 2)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    paintVideo(h, 'v');
    h.panel.setOpen(false); h.panel.setOpen(true);
    const before = h.boxes.map((b) => ({ ...b }));

    rightClick(h.bar('v'));
    const detach = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim().startsWith('Detach audio'))!;
    click(detach);
    assert.equal(h.commits.length, 1, 'detach is ONE commit');
    const detached = h.commits[0]!;
    assert.equal(detached.length, 3, 'one new box');
    const sound = detached.find((b) => !before.some((x) => x.id === b.id))!;
    assert.equal(sound.lane, '', 'on an overlay lane');
    assert.equal(String(sound.linkOf), 'v');
    assert.equal(String(detached.find((b) => b.id === 'v')!.linkOf), String(sound.id));
    assert.equal(detached.find((b) => b.id === 'v')!.mute, true, 'the picture is silenced');

    h.notify();
    await frames(3);
    // Re-attach from the VIDEO's side.
    rightClick(h.bar('v'));
    const back = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim().startsWith('Re-attach audio'))!;
    assert.ok(back, 'the same menu now offers the inverse');
    click(back);
    assert.equal(h.commits.length, 2, 're-attach is ONE commit');
    // Back to the shape we started from: same ids, same timing, no link, not muted.
    assert.deepEqual(
      h.commits[1]!.map((b) => [b.id, b.start, b.dur, b.lane, b.mute ?? '', b.linkOf ?? '']),
      before.map((b) => [b.id, b.start, b.dur, b.lane, '', '']),
    );
  } finally { h.teardown(); }
});

test('Shift+D detaches from the keyboard, and again to put it back', async () => {
  const h = mount([clip('v', 0, 4)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    paintVideo(h, 'v');
    h.panel.setOpen(false); h.panel.setOpen(true);
    const el = armKeys(h, 'v', 60);
    press(el, 'd');
    assert.equal(h.commits.length, 0, 'a bare `d` is not the shortcut - nothing happens');
    press(el, 'D', { shiftKey: true });
    assert.equal(h.commits.length, 1, 'Shift+D detached');
    assert.equal(h.commits[0]!.length, 2);
    h.notify();
    await frames(3);
    press(h.bar('v'), 'D', { shiftKey: true });
    assert.equal(h.commits.length, 2, 'and again re-attached');
    assert.equal(h.commits[1]!.length, 1);
  } finally { h.teardown(); }
});

test('clicking a linked bar selects BOTH halves; Alt-click selects just the one', async () => {
  const h = mount([
    { id: 'v', start: 0, dur: 4, lane: 'seq', mute: true, linkOf: 's' },
    { id: 's', start: 0, dur: 4, lane: '', linkOf: 'v' },
  ], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    await frames(2);
    // The link badge is painted on both halves, and the video side says where it went.
    assert.ok(h.bar('v').classList.contains('is-linked'));
    assert.ok(h.bar('s').classList.contains('is-linked'));
    assert.equal(h.bar('v').querySelector('.tl-clip-link')?.getAttribute('title'), 'Sound is on its own lane');
    assert.equal(h.bar('s').querySelector('.tl-clip-link')?.getAttribute('title'), 'Sound detached from this clip');

    h.selSets.length = 0;
    const el = h.bar('v');
    el.dispatchEvent(pointer('pointerdown', 20));
    h.root.dispatchEvent(pointer('pointerup', 20));
    assert.deepEqual(h.selSets.at(-1), ['v', 's'], 'picture and sound travel together');

    h.selSets.length = 0;
    el.dispatchEvent(pointer('pointerdown', 20, { altKey: true }));
    h.root.dispatchEvent(pointer('pointerup', 20, { altKey: true }));
    assert.deepEqual(h.selSets.at(-1), ['v'], 'Alt is the established "just this one" idiom');
    assert.equal(h.commits.length, 0, 'selecting edits nothing');
  } finally { h.teardown(); }
});

// ── onion skin: OFF by default, opt-in, device-local ──────────────────────────
//
// The DRAWING lives in views/onion-skin.ts (and its own test file pins the export
// contract). What is asserted here is the preference and the seam: nothing is on until
// someone turns it on, turning it on persists and repaints, and a browser that refuses
// storage does not cost the user the feature for this session.

/** An in-memory Storage, installed on globalThis for the duration of one test. */
function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage & { map: Map<string, string> };
}

/** AWAITS `run` before restoring - the panel reads `localStorage` lazily, so a
 *  synchronous try/finally would put the real global back mid-test. */
async function withStorage(store: unknown, run: () => Promise<void>): Promise<void> {
  const had = Object.hasOwn(globalThis, 'localStorage');
  const prev = (globalThis as Record<string, unknown>).localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  try { await run(); } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true, writable: true });
    else delete (globalThis as Record<string, unknown>).localStorage;
  }
}

const onionBtnOf = (h: Harness): HTMLElement => h.root.querySelector('.tl-onion') as HTMLElement;

test('onion skin is OFF with nothing stored, and no tl-time carries a mode', async () => {
  const store = fakeStorage();
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
    try {
      await frames(3);
      const btn = onionBtnOf(h);
      assert.ok(btn, 'the toggle is in the tool row');
      assert.equal(btn.getAttribute('aria-pressed'), 'false');
      assert.equal(btn.classList.contains('is-active'), false);
      assert.equal(store.map.has('lolly:onion'), false, 'absence IS the off state - nothing written');

      const seen: Array<{ mode?: string }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
      await frames(3);
      assert.ok(seen.length > 0, 'precondition: crossing the cut still fires the seam');
      for (const d of seen) assert.equal(d.mode, '', 'an empty mode is what stops free-canvas loading the chunk');
    } finally { h.teardown(); }
  });
});

test('toggling onion skin persists the preference and fires ONE tl-time carrying the ghosts', async () => {
  const store = fakeStorage();
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 2)]);
    try {
      await frames(3);
      // Park the playhead inside the middle clip, so there is a ghost on each side.
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
      await frames(3);

      const seen: Array<{ mode?: string; past?: string[]; future?: string[]; opacity?: number }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });

      const btn = onionBtnOf(h);
      btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      assert.equal(seen.length, 1, 'exactly one repaint request, and no waiting for a tick');
      assert.equal(seen[0]!.mode, 'outline', 'outlines are the default: a filled ghost hides under an opaque scene');
      assert.deepEqual(seen[0]!.past, ['a']);
      assert.deepEqual(seen[0]!.future, ['c']);
      assert.equal(seen[0]!.opacity, 1);
      assert.equal(btn.getAttribute('aria-pressed'), 'true');
      assert.ok(btn.classList.contains('is-active'));

      const stored = JSON.parse(store.map.get('lolly:onion')!) as Record<string, unknown>;
      assert.deepEqual(stored, { mode: 'outline', before: 1, after: 1, opacity: 1 });

      // Off again: the record is REMOVED, not written as `on:false`.
      btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      assert.equal(store.map.has('lolly:onion'), false);
      assert.equal(seen.length, 2);
      assert.equal(seen[1]!.mode, '');
      assert.equal(btn.getAttribute('aria-pressed'), 'false');
    } finally { h.teardown(); }
  });
});

test('a stored preference is honoured on mount, junk and all', async () => {
  const store = fakeStorage();
  store.map.set('lolly:onion', JSON.stringify({ mode: 'filled', before: 9, after: -1, opacity: 0.4 }));
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 2), clip('b', 2, 2), clip('c', 4, 2), clip('d', 6, 2)]);
    try {
      await frames(3);
      assert.equal(onionBtnOf(h).getAttribute('aria-pressed'), 'true', 'on before anything is clicked');
      const seen: Array<{ mode?: string; past?: string[]; future?: string[]; opacity?: number }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 6500 } }));
      await frames(3);
      const last = seen.at(-1)!;
      assert.equal(last.mode, 'filled');
      assert.equal(last.opacity, 0.4);
      assert.deepEqual(last.past, ['c', 'b'], 'before:9 clamped to the two-step ceiling');
      assert.deepEqual(last.future, [], 'after:-1 clamped to none');
    } finally { h.teardown(); }
  });
});

test('a hostile stored record degrades to a usable preference rather than throwing', async () => {
  for (const raw of ['{', 'null', '[]', '"outline"', '{"mode":"rainbow","opacity":"loud"}']) {
    const store = fakeStorage();
    store.map.set('lolly:onion', raw);
    await withStorage(store, async () => {
      const h = mount([clip('a', 0, 3)]);
      try {
        await frames(2);
        const btn = onionBtnOf(h);
        // Only a well-formed OBJECT counts as a stored preference; the rest read as off.
        const on = raw.startsWith('{"mode"');
        assert.equal(btn.getAttribute('aria-pressed'), on ? 'true' : 'false', `raw ${raw}`);
      } finally { h.teardown(); }
    });
  }
});

test('localStorage throwing does not break the toggle - the session still gets its ghosts', async () => {
  const hostile = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  await withStorage(hostile, async () => {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 2)]);
    try {
      await frames(3);
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
      await frames(3);
      const seen: Array<{ mode?: string }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });
      const btn = onionBtnOf(h);
      assert.equal(btn.getAttribute('aria-pressed'), 'false', 'a read that threw reads as off');
      btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      assert.equal(btn.getAttribute('aria-pressed'), 'true', 'the toggle still flipped');
      assert.equal(seen.at(-1)?.mode, 'outline', 'and the canvas was still told to draw');
    } finally { h.teardown(); }
  });
});

test('`o` toggles the onion skin from the keyboard; a model change re-emits the ghosts', async () => {
  const store = fakeStorage();
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 2)]);
    try {
      await frames(3);
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3500 } }));
      await frames(3);
      const seen: Array<{ mode?: string; past?: string[]; future?: string[] }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });

      h.root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true }));
      assert.equal(seen.at(-1)?.mode, 'outline');
      assert.deepEqual(seen.at(-1)?.past, ['a']);

      // A MODEL change moves the ghosts without moving the clock. Deleting the clip
      // before the playhead must re-emit, or the ghost would name a box that is gone.
      h.select(['a']);
      h.root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      h.notify();
      await frames(3);
      assert.equal(seen.at(-1)?.past?.includes('a'), false, 'the deleted clip is no longer a ghost');

      h.root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true }));
      assert.equal(seen.at(-1)?.mode, '', 'and `o` again turns it off');
    } finally { h.teardown(); }
  });
});

// ── discoverability: the shortcuts sheet + the blade's resolved-scope label ────

/**
 * jsdom implements `<dialog>` only as far as the `open` property - there is no
 * showModal(), no close(), and none of the dialog-closing steps. Fill in exactly the
 * three things components/modal.ts touches. Two consequences, stated so nothing below
 * reads as more than it is:
 *   • Escape does not synthesise a `cancel` event here, so the test dispatches one - 
 *     that IS what a browser does to an open modal dialog, and it is the event
 *     mountModal listens to;
 *   • the focus RESTORE asserted below is the panel's own (openShortcuts remembers the
 *     element that was focused and puts it back in onClose), not this stub's - the stub
 *     deliberately does not move focus at all, so the assertion has something to prove.
 */
{
  const proto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLElement): void { this.setAttribute('open', ''); };
    proto.close = function close(this: HTMLElement): void {
      this.removeAttribute('open');
      this.dispatchEvent(new dom.window.Event('close'));
    };
  }
}

/**
 * Every `case` label in timeline-panel.ts's `onKey` switch, maintained BY HAND.
 *
 * This is the half of the drift guard a machine cannot derive: it is a transcription of
 * the source, so adding a shortcut to the handler without documenting it in
 * PANEL_SHORTCUTS fails here rather than shipping an invisible key. Compared
 * case-insensitively, since the handler folds `s`/`S`, `e`/`E`, `o`/`O`, `f`/`F` and
 * `d`/`D` into one branch and reads the modifier off the event.
 */
const ON_KEY_BRANCHES = [
  ' ', 'Spacebar', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
  's', 'S', 'd', 'D', '[', ']', ',', '<', '.', '>', 'e', 'E', 'o', 'O', 'k', 'K',
  '+', '=', '-', '_', 'f', 'F', 'Delete', 'Backspace', '?', 'ContextMenu', 'F10', 'Escape',
];

/** Close anything a driven shortcut may have opened (body popover or the sheet). */
function closeOverlays(): void {
  const doc = dom.window.document;
  for (const dlg of Array.from(doc.querySelectorAll('dialog'))) {
    dlg.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  }
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

test('the shortcuts sheet cannot drift from the key handler: every documented key is handled', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 2)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    for (const row of PANEL_SHORTCUTS) {
      for (const ev of row.events) {
        // Escape closes the panel, `o` opens a popover, `?` opens the sheet - put the
        // panel back in its resting state before each press so every row is driven
        // against the same panel, not against the wreckage of the last one.
        h.panel.setOpen(true);
        h.root.dispatchEvent(new dom.window.Event('pointerenter'));
        const e = new dom.window.KeyboardEvent('keydown', {
          key: ev.key, shiftKey: !!ev.shiftKey, altKey: !!ev.altKey, bubbles: true, cancelable: true,
        });
        h.root.dispatchEvent(e);
        assert.equal(e.defaultPrevented, true, `${row.keys} (${JSON.stringify(ev)}) - "${row.label}" is documented but not handled`);
        closeOverlays();
      }
    }
    // The modifier-only row (Alt) is the one that legitimately has no branch.
    assert.deepEqual(
      PANEL_SHORTCUTS.filter((r) => !r.events.length).map((r) => r.keys),
      ['Alt'],
      'only a modifier may be documented without a keydown branch of its own',
    );
    for (const row of PANEL_SHORTCUTS) {
      assert.ok(row.keys.trim(), 'every row prints a key');
      assert.ok(row.label.trim(), `${row.keys} says what it does`);
    }
  } finally { h.teardown(); }
});

test('the shortcuts sheet cannot drift from the key handler: every handled key is documented', () => {
  const documented = new Set(
    PANEL_SHORTCUTS.flatMap((r) => r.events.map((e) => e.key.toLowerCase())),
  );
  const undocumented = ON_KEY_BRANCHES.filter((k) => !documented.has(k.toLowerCase()));
  assert.deepEqual(
    undocumented, [],
    'onKey handles a key the sheet never mentions. Every shortcut this panel binds is a '
      + 'bare letter or punctuation chosen because no browser fights for it - which means '
      + 'none of them is guessable, and an undocumented one is unreachable.',
  );
});

test('`?` opens the shortcuts sheet, and closing it puts focus back where it came from', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    const el = h.bar('a');
    el.focus();
    press(el, '?');

    const dlg = dom.window.document.querySelector('dialog.tl-keys-modal') as HTMLDialogElement | null;
    assert.ok(dlg, 'the sheet mounted');
    const rows = Array.from(dlg!.querySelectorAll('.tl-keys-table tr'));
    assert.deepEqual(
      rows.map((r) => r.querySelector('kbd')?.textContent),
      PANEL_SHORTCUTS.map((s) => s.keys),
      'the sheet IS PANEL_SHORTCUTS, in order - there is no second list to keep in step',
    );
    assert.deepEqual(
      rows.map((r) => r.querySelector('.tl-keys-what')?.firstChild?.textContent),
      PANEL_SHORTCUTS.map((s) => s.label),
    );
    assert.ok(rows.some((r) => r.querySelector('.tl-keys-hint')), 'the modifier hints are printed too');

    // Escape on an open modal dialog fires `cancel`, which is what mountModal listens to.
    dlg!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
    assert.equal(dom.window.document.querySelector('dialog.tl-keys-modal'), null, 'Escape closed and removed it');
    assert.equal(dom.window.document.activeElement, el, 'and focus went back to the bar it was opened from');
  } finally { closeOverlays(); h.teardown(); }
});

test('the toolbar button opens the same sheet, and closing it returns focus to the button', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    const btn = h.root.querySelector('.tl-keys') as HTMLButtonElement;
    assert.ok(btn, 'the panel has a shortcuts button');
    assert.equal(btn.getAttribute('aria-label'), 'Keyboard shortcuts');
    assert.equal(btn.getAttribute('data-tip'), 'Keyboard shortcuts', 'label AND tip, per the btn() contract');
    btn.focus();
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const dlg = dom.window.document.querySelector('dialog.tl-keys-modal') as HTMLDialogElement | null;
    assert.ok(dlg, 'the sheet mounted');
    dlg!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
    assert.equal(dom.window.document.activeElement, btn, 'focus returned to the trigger');
  } finally { closeOverlays(); h.teardown(); }
});

test('the onion button carries both an aria-label and a data-tip, like every other tool button', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    const btn = h.root.querySelector('.tl-onion') as HTMLButtonElement;
    assert.equal(btn.getAttribute('aria-label'), 'Onion skin');
    assert.equal(btn.getAttribute('data-tip'), 'Onion skin');
  } finally { h.teardown(); }
});

/** The blade is inert via aria-disabled, NEVER the property - see the next test. */
const bladeOff = (b: HTMLButtonElement): boolean => b.getAttribute('aria-disabled') === 'true';

test('the Split button says what it would cut, and is disabled when it would cut nothing', async () => {
  const h = mount([clip('a', 0, 3), overlay('o1', 0, 3), overlay('o2', 0, 3), clip('b', 3, 2)]);
  try {
    const btn = h.root.querySelector('.tl-split') as HTMLButtonElement;
    await frames(3);
    // The playhead sits at 0 - every clip STARTS there, and a cut at a clip's own start
    // is not a split. Disabled, rather than a refusal announced after the click.
    assert.equal(bladeOff(btn), true, 'nothing to cut at zero');
    assert.equal(btn.getAttribute('data-tip'), 'Split at playhead');

    // Inside one clip, with nothing selected: the seq clip under the playhead.
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 1500 } }));
    await frames(3);
    assert.equal(bladeOff(btn), false);
    assert.equal(btn.getAttribute('data-tip'), 'Split clip');
    assert.equal(btn.getAttribute('aria-label'), 'Split clip', 'the label and the tip are the same sentence');

    // A selection that spans the playhead takes over the scope - and says how much.
    h.select(['a', 'o1', 'o2']);
    assert.equal(btn.getAttribute('data-tip'), 'Split 3 clips');
    assert.equal(bladeOff(btn), false);

    // Past the end of everything: nothing selected spans it, nothing lies under it.
    h.select([]);
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 60_000 } }));
    await frames(3);
    assert.equal(btn.getAttribute('data-tip'), 'Split at playhead');
    assert.equal(bladeOff(btn), true, 'and the blade goes quiet again');
  } finally { h.teardown(); }
});

test('the Split blade goes inert with aria-disabled, never the property - pressing it must not drop focus', async () => {
  // A successful split leaves the playhead exactly on the cut it just made, so the blade
  // resolves "nothing to cut" on the very next restyle: it goes inert the instant you use
  // it. With the real `disabled` property the browser unfocuses a focused control, focus
  // falls to <body>, and since the panel's key handler is bound on `root` and gated by
  // panelKeysActive, a keyboard user would lose EVERY panel shortcut at that moment.
  // jsdom does not implement blur-on-disable, so the invariant is pinned structurally:
  // the property is never written, and the press is swallowed by the handler instead.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const btn = h.root.querySelector('.tl-split') as HTMLButtonElement;
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 1500 } }));
    await frames(3);
    assert.equal(bladeOff(btn), false, 'armed inside clip a');

    btn.focus();
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await frames(3);

    assert.equal(h.commits.length, 1, 'the cut landed');
    assert.equal(bladeOff(btn), true, 'and the blade correctly reports nothing left to cut here');
    assert.equal(btn.disabled, false, 'but the DOM property is never written - the button stays focusable');
    assert.equal(dom.window.document.activeElement, btn, 'so focus stays on the blade');

    // Inert means inert: a second press writes nothing at all.
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await frames(1);
    assert.equal(h.commits.length, 1, 'an aria-disabled press is swallowed');

    // And the panel keyboard is still live from that focus, which is the whole point.
    const before = h.selSets.length;
    const ev = new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    btn.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, true, 'the panel still owns the arrow keys');
    assert.ok(h.selSets.length > before, 'and the shortcut did its work');
  } finally { h.teardown(); }
});

test('the blade never promises a cut the press then refuses - the MIN_DUR band and open-ended clips', async () => {
  // splitBox refuses within MIN_DUR (0.1s) of either edge rather than mint a sliver, and
  // refuses an open-ended clip outright (no end to split against). Snapping does not
  // cover the first gap: the tolerance is SNAP_PX_FINE/pxPerSec, which is under 0.1s at
  // any zoom past 80px/s. So the label has to ask splitBox's own question.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)], 200);
  try {
    const btn = h.root.querySelector('.tl-split') as HTMLButtonElement;
    // 3.050s: 50ms past the a|b cut, inside b's span but inside the MIN_DUR band, and
    // 10px from the cut at 200px/s - beyond the 8px snap tolerance, so it stays there.
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 3050 } }));
    await frames(3);
    assert.equal(bladeOff(btn), true, 'the blade is inert inside the sliver band');
    assert.equal(btn.getAttribute('data-tip'), 'Split at playhead');
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.commits.length, 0, 'and the press writes nothing - label and press agree');

    // Clear of the band, the same clip is splittable.
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 4000 } }));
    await frames(3);
    assert.equal(bladeOff(btn), false);
    assert.equal(btn.getAttribute('data-tip'), 'Split clip');
  } finally { h.teardown(); }
});

test('an OPEN-ENDED overlay is never offered as splittable - splitBox has no end to cut against', async () => {
  const h = mount([clip('a', 0, 5), { id: 'o', start: 1, dur: '', lane: '' } as Box]);
  try {
    const btn = h.root.querySelector('.tl-split') as HTMLButtonElement;
    h.select(['o']);
    h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 2000 } }));
    await frames(3);
    // `a` is under the playhead, so the blade is live - but the SELECTION scope must not
    // pick up the open-ended overlay, or the label would read "Split 2 clips".
    assert.equal(btn.getAttribute('data-tip'), 'Split clip', 'the open-ended overlay is not counted');
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await frames(1);
    assert.equal(h.commits.length, 1);
    assert.equal(h.commits[0]!.filter((b) => b.id === 'o').length, 1, 'and it was not cut in two');
  } finally { h.teardown(); }
});

test('Caps Lock cannot invert the onion pair: the branch reads e.shiftKey, not the letter case', () => {
  // KeyboardEvent.key reports the PRODUCED character, so with Caps Lock on a bare `o`
  // arrives as 'O' with shiftKey false, and Shift+o arrives as 'o' with shiftKey true.
  // A handler that branched on the letter's case would swap the two.
  for (const [key, shiftKey, wantPopover] of [
    ['o', false, false], ['O', false, false],   // both bare forms toggle
    ['O', true, true], ['o', true, true],       // both shifted forms open the options
  ] as const) {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
    try {
      h.root.dispatchEvent(new dom.window.Event('pointerenter'));
      const btn = onionBtnOf(h);
      press(h.root, key, { shiftKey });
      const pop = dom.window.document.querySelector('.tl-onion-pop');
      if (wantPopover) {
        assert.ok(pop, `Shift+${key}: the options popover opened`);
        assert.equal(btn.getAttribute('aria-pressed'), 'false', 'and the layer was NOT toggled');
      } else {
        assert.equal(pop, null, `${key}: no popover`);
        assert.equal(btn.getAttribute('aria-pressed'), 'true', 'the layer toggled on');
      }
    } finally { closeOverlays(); h.teardown(); }
  }
});

test('the panel declines Ctrl/Cmd/Alt chords - Save, Find, Open and browser zoom are not hijacked', () => {
  // Every binding here is a bare letter or punctuation chosen BECAUSE no browser fights
  // for it. That reasoning only holds if the handler also declines the CHORD: otherwise
  // Cmd+S splits instead of saving, Cmd+F fits instead of finding, and Ctrl+- zooms the
  // timeline instead of the page - each of them preventDefault()ed.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    const el = h.bar('a');
    el.focus();
    h.commits.length = 0;
    const chords: Array<[string, Record<string, boolean>]> = [
      ['s', { metaKey: true }], ['s', { ctrlKey: true }],
      ['f', { metaKey: true }], ['o', { metaKey: true }],
      ['[', { metaKey: true }], [']', { metaKey: true }],
      ['-', { ctrlKey: true }], ['=', { ctrlKey: true }],
      // Alt+letter stays the browser's / the OS's: the ONE alt chord this panel takes
      // is Alt+arrow (asserted below), and it is taken by naming the two keys, never
      // by opening the modifier up.
      ['s', { altKey: true }], ['k', { altKey: true }],
      ['ArrowLeft', { metaKey: true }], ['Escape', { metaKey: true }],
    ];
    for (const [key, mods] of chords) {
      const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
      el.dispatchEvent(e);
      assert.equal(e.defaultPrevented, false, `${JSON.stringify(mods)}+${key} belongs to the browser`);
    }
    assert.equal(h.commits.length, 0, 'and none of them edited the model');
    assert.equal(h.panel.isOpen(), true, 'nor closed the panel');

    // The unmodified key still works, so the guard is a filter and not a mute.
    const ok = new dom.window.KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true });
    el.dispatchEvent(ok);
    assert.equal(ok.defaultPrevented, true, 'bare `s` is still the panel\'s');

    // …and the documented exception IS taken (plans/104 section 8): Alt+←/→ walks keyframes.
    // Asserted here, beside the rule it is an exception to, so the two can never drift
    // into "the guard was quietly relaxed".
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      const alt = new dom.window.KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true });
      el.dispatchEvent(alt);
      assert.equal(alt.defaultPrevented, true, `Alt+${key} is the panel's - previous/next keyframe`);
    }
  } finally { h.teardown(); }
});

test('the shortcuts sheet drift guard also covers the modifier chord for every documented key', () => {
  // The guard above drives {key, shiftKey} only, so it cannot see a handler that claims
  // Cmd/Ctrl/Alt as well. Drive the same rows again with each modifier and require the
  // event to survive untouched.
  //
  // A chord any row DOCUMENTS is skipped, and only that exact chord - the exception
  // is declared in the same list the sheet prints, never in an exclusion list here.
  // The set is built across ALL rows, not per row: Alt+← is documented by "Previous or
  // next keyframe", which is precisely why the bare "← →" row must not be driven with
  // Alt and asserted untouched. Every other modifier on every key is still required to
  // pass straight through, so claiming Alt+← does not quietly claim Cmd+← as well.
  const claimed = new Set(
    PANEL_SHORTCUTS.flatMap((r) => r.events.filter((e) => e.altKey).map((e) => `altKey|${e.key}`)),
  );
  assert.ok(claimed.size > 0, 'precondition: at least one documented chord, or this guard proves nothing new');
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    h.panel.setOpen(true);
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    for (const row of PANEL_SHORTCUTS) {
      for (const ev of row.events) {
        for (const mod of ['metaKey', 'ctrlKey', 'altKey'] as const) {
          if (claimed.has(`${mod}|${ev.key}`)) continue;
          const e = new dom.window.KeyboardEvent('keydown', {
            key: ev.key, shiftKey: !!ev.shiftKey, [mod]: true, bubbles: true, cancelable: true,
          });
          h.root.dispatchEvent(e);
          assert.equal(e.defaultPrevented, false, `${mod}+${row.keys} - "${row.label}" swallowed a browser chord`);
        }
      }
    }
  } finally { closeOverlays(); h.teardown(); }
});

test('Escape during a LIVE trim leaves the trim, not the panel - one rung per press', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    const el = h.bar('a');
    const badge = h.root.querySelector('.tl-trim-badge') as HTMLElement;
    el.dispatchEvent(pointer('pointerdown', 118));                      // a's out edge
    h.root.dispatchEvent(pointer('pointermove', 78, { altKey: true }));
    await frames(3);
    assert.equal(el.classList.contains('is-trimming'), true, 'precondition: a visible mode');
    assert.equal(badge.hidden, false);

    press(h.root, 'Escape');
    assert.equal(el.classList.contains('is-trimming'), false, 'the trim was abandoned');
    assert.equal(badge.hidden, true);
    assert.equal(h.panel.isOpen(), true, 'and the panel is STILL OPEN - Escape took one rung');
    // The pointerup that follows finds no gesture, so nothing is written either way.
    h.root.dispatchEvent(pointer('pointerup', 78, { altKey: true }));
    assert.equal(h.commits.length, 0, 'an abandoned trim writes nothing');
    await frames(3);
    assert.equal(el.style.width, '120px', 'and the live preview was repainted back to the model');

    // A second press now closes the panel, the way the ladder promises.
    press(h.root, 'Escape');
    assert.equal(h.panel.isOpen(), false);
  } finally { h.teardown(); }
});

test('the first clip on the magnetic row can put its trimmed-in head BACK', () => {
  // `trimClip`'s "can't pull the clip before t=0" bound is only real on an OVERLAY: the
  // seq row's start is re-derived by packOrder. At index 0 it used to pin the lower
  // bound at 0, so a head trim on the first clip was the one edit in the sequence that
  // could never be undone by dragging the same edge back.
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = h.bar('a');
    el.dispatchEvent(pointer('pointerdown', 2));                          // a's in edge
    h.root.dispatchEvent(pointer('pointermove', 42, { altKey: true }));   // +1s
    h.root.dispatchEvent(pointer('pointerup', 42, { altKey: true }));
    const a1 = h.commits[0]!.find((x) => x.id === 'a')!;
    assert.equal(Number(a1.clipIn), 1, 'precondition: a second of source is behind the in point');
    assert.equal(Number(a1.dur), 2);

    // Now drag the same edge the other way. There is a second of source to give back.
    const el2 = h.bar('a');
    el2.dispatchEvent(pointer('pointerdown', 2));
    h.root.dispatchEvent(pointer('pointermove', -38, { altKey: true }));  // -1s
    h.root.dispatchEvent(pointer('pointerup', -38, { altKey: true }));
    assert.equal(h.commits.length, 2, 'the second drag committed');
    const a2 = h.commits[1]!.find((x) => x.id === 'a')!;
    assert.equal(Number(a2.clipIn), 0, 'the source in-point went back where it started');
    assert.equal(Number(a2.dur), 3, 'and the clip got its head back');
    assert.equal(Number(a2.start), 0, 'the magnetic row still starts at zero');
  } finally { h.teardown(); }
});

test('deleting a detached sound un-mutes the picture and takes the dangling link with it', () => {
  const h = mount(
    [{ id: 'v', start: 0, dur: 4, lane: 'seq', mute: true, linkOf: 's' } as Box,
      { id: 's', start: 0, dur: 4, lane: '' } as Box],
    40, AUDIO_KINDS, { linkField: 'linkOf' },
  );
  try {
    const sound = armKeys(h, 's', 60);
    press(sound, 'Delete');
    assert.equal(h.commits.length, 1);
    const v = h.commits[0]!.find((b) => b.id === 'v')!;
    assert.equal(h.commits[0]!.length, 1, 'the sound is gone');
    assert.equal(String(v.linkOf ?? ''), '', 'and its partner is not left pointing at a ghost');
    assert.ok(v.mute !== true && v.mute !== 'true',
      'the picture was only silent because its sound lived on that clip - it is audible again');
  } finally { h.teardown(); }
});

test('deleting the PICTURE clears the dangling link on the sound that survives it', () => {
  const h = mount(
    [{ id: 'v', start: 0, dur: 4, lane: 'seq', mute: true, linkOf: 's' } as Box,
      { id: 's', start: 0, dur: 4, lane: '', linkOf: 'v' } as Box],
    40, AUDIO_KINDS, { linkField: 'linkOf' },
  );
  try {
    const pic = armKeys(h, 'v', 60);
    press(pic, 'Delete');
    const s = h.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(String(s.linkOf ?? ''), '', 'no dangling id survives the delete');
    assert.ok(s.mute !== true && s.mute !== 'true', 'and an audible sound stays audible');
  } finally { h.teardown(); }
});

test('a delete with nothing linked returns the SAME array the ripple produced', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    const el = armKeys(h, 'a', 60);
    press(el, 'Delete');
    assert.deepEqual(h.commits[0]!.map((b) => b.id), ['b'], 'the sweep is a no-op when nothing points anywhere');
    assert.equal(Number(h.commits[0]![0]!.start), 0, 'and the ripple still ran');
  } finally { h.teardown(); }
});

test('the reachable-media ghost is SHOWN during a trim, spanning the whole source', async () => {
  // The suite already pins that it comes off on release; this pins that it goes ON, and
  // where. `left`/`width` are pure arithmetic over the model (timeToPx), so jsdom's zero
  // rects do not reach them - only `top`/`height`, which are deliberately not asserted.
  const h = mount([clip('a', 0, 5), overlay('o', 1, 2)]);
  try {
    // A 6s source behind a 2s clip that starts 1s into it: reachable span is 0s → 6s.
    paintMediaBoxes(h, { o: '<div class="lolly-box-audio" data-audio-src="vo.mp3" data-audio-dur="6000"></div>' });
    const boxes = h.boxes;
    (boxes.find((b) => b.id === 'o') as Box).clipIn = 1;
    const extent = h.root.querySelector('.tl-clip-extent') as HTMLElement;
    assert.equal(extent.hidden, true, 'hidden at rest');

    const el = h.bar('o');
    el.dispatchEvent(pointer('pointerdown', 118));                        // o's out edge (3s = 120px)
    h.root.dispatchEvent(pointer('pointermove', 138, { altKey: true }));
    await frames(3);
    assert.equal(extent.hidden, false, 'the ghost is on screen for the length of the drag');
    assert.equal(extent.style.left, '0px', 'starting where the source starts (1s of head, 1s before the clip)');
    assert.equal(extent.style.width, '240px', 'and running the source\'s whole 6s at 40px/s');

    h.root.dispatchEvent(pointer('pointerup', 138, { altKey: true }));
    assert.equal(extent.hidden, true);
  } finally { h.teardown(); }
});

// ── the onion-skin OPTIONS popover ────────────────────────────────────────────
//
// The toggle above is well covered; the popover behind it was not covered at all. Three
// things only it can get wrong: that changing an option turns the feature ON (the
// popover implies intent - you do not open it to configure something invisible), that
// the long press and the click which ENDS it do not fight each other, and that the
// controls write through the same clamped writers the stored record is read with.

const onionPop = (): HTMLElement | null =>
  dom.window.document.querySelector('.tl-onion-pop') as HTMLElement | null;

test('right-clicking the onion button opens its options, and a second right-click closes them', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const btn = onionBtnOf(h);
    assert.equal(btn.getAttribute('aria-haspopup'), 'dialog', 'the button says a dialog is behind it');
    rightClick(btn);
    const pop = onionPop();
    assert.ok(pop, 'the options opened');
    assert.equal(pop!.getAttribute('role'), 'dialog');
    assert.equal(pop!.getAttribute('aria-label'), 'Onion skin options');
    assert.deepEqual(
      Array.from(pop!.querySelectorAll('.tl-onion-row .field-label')).map((n) => n.textContent),
      ['Mode', 'Scenes before', 'Scenes after', 'Ghost strength'],
      'mode, two INDEPENDENT counts, and the master strength',
    );
    assert.equal(btn.getAttribute('aria-pressed'), 'false', 'opening the options is not a toggle');
    rightClick(btn);
    assert.equal(onionPop(), null, 're-invoking closes, like every other disclosure here');
  } finally { closeOverlays(); h.teardown(); }
});

test('Shift+O opens the options without toggling the layer', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    press(h.root, 'O', { shiftKey: true });
    assert.ok(onionPop(), 'the keyboard reaches the same dialog the pointer does');
    assert.equal(onionBtnOf(h).getAttribute('aria-pressed'), 'false');
  } finally { closeOverlays(); h.teardown(); }
});

test('changing an option turns the feature ON, and writes through the clamped writers', async () => {
  const store = fakeStorage();
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 2), clip('b', 2, 2), clip('c', 4, 2), clip('d', 6, 2)]);
    try {
      await frames(3);
      const btn = onionBtnOf(h);
      assert.equal(btn.getAttribute('aria-pressed'), 'false', 'precondition: off');
      rightClick(btn);

      const mode = onionPop()!.querySelector('select') as HTMLSelectElement;
      mode.value = 'filled';
      mode.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      assert.equal(btn.getAttribute('aria-pressed'), 'true',
        'you do not open the options to configure something invisible - the change turns it on');
      assert.deepEqual(JSON.parse(store.map.get('lolly:onion')!), { mode: 'filled', before: 1, after: 1, opacity: 1 });

      // The steppers are independent, and both clamp to the 0…ONION_MAX_STEPS ceiling.
      const [before, after] = Array.from(onionPop()!.querySelectorAll('.tl-onion-step')) as HTMLInputElement[];
      assert.equal(before!.max, '2', 'the control states the same ceiling the writer enforces');
      before!.value = '9';
      before!.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      after!.value = '-3';
      after!.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      const range = onionPop()!.querySelector('.field-range') as HTMLInputElement;
      range.value = '40';
      range.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      assert.deepEqual(JSON.parse(store.map.get('lolly:onion')!), { mode: 'filled', before: 2, after: 0, opacity: 0.4 });

      // And the canvas is told, with the counts honoured independently.
      const seen: Array<{ past?: string[]; future?: string[]; opacity?: number }> = [];
      h.stageEl.addEventListener('tl-time', (e) => { seen.push((e as CustomEvent).detail); });
      h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 6500 } }));
      await frames(3);
      const last = seen.at(-1)!;
      assert.deepEqual(last.past, ['c', 'b'], 'two behind');
      assert.deepEqual(last.future, [], 'none ahead');
      assert.equal(last.opacity, 0.4);
    } finally { closeOverlays(); h.teardown(); }
  });
});

test('a LONG press opens the options - and the click that ends it does not toggle the layer', async () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const btn = onionBtnOf(h);
    btn.dispatchEvent(pointer('pointerdown', 10));
    await new Promise((r) => setTimeout(r, 560));           // past the 500ms hold
    assert.ok(onionPop(), 'the hold opened the options');
    btn.dispatchEvent(pointer('pointerup', 10));
    click(btn);                                            // the press-ending click
    assert.equal(btn.getAttribute('aria-pressed'), 'false',
      'the click that ends a long press must not undo what the press did');

    // A plain, short press is still a toggle.
    closeOverlays();
    btn.dispatchEvent(pointer('pointerdown', 10));
    btn.dispatchEvent(pointer('pointerup', 10));
    click(btn);
    assert.equal(btn.getAttribute('aria-pressed'), 'true', 'a short press still toggles');
  } finally { closeOverlays(); h.teardown(); }
});

// ── coarse-pointer snapping ───────────────────────────────────────────────────

test('the snap tolerance follows the POINTER: a finger snaps from 12px, a cursor only from 8', async () => {
  // A 2s overlay (80px at 40px/s) dragged so its in-point lands 10px - 0.25s - short of
  // the a|b cut at 3s. Inside the 12px touch window, outside the 8px cursor one. Grabbed
  // at 50px: clear of BOTH the 10px cursor zone and the 24px touch zone, so it is a move
  // either way and the only difference under test is the snap tolerance.
  for (const [pointerType, wantStart] of [['touch', 3], ['mouse', 2.75]] as const) {
    const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 0, 2)]);
    try {
      const el = h.bar('o');
      const grabAt = 50;                                     // the BODY, so this is a move
      el.dispatchEvent(pointer('pointerdown', grabAt, { pointerType }));
      h.root.dispatchEvent(pointer('pointermove', grabAt + 110, { pointerType }));
      await frames(3);
      h.root.dispatchEvent(pointer('pointerup', grabAt + 110, { pointerType }));
      const o = h.commits[0]!.find((b) => b.id === 'o')!;
      assert.equal(Number(o.start), wantStart, pointerType === 'touch'
        ? 'a finger 10px out still landed ON the cut'
        : 'a cursor 10px out stayed exactly where it was put');
    } finally { h.teardown(); }
  }
});

test('a newly engaged snap ticks the vibrator - on a finger only, and never under reduced motion', async () => {
  // The panel reads the AMBIENT `navigator`, not window's - node has one of its own and
  // this file does not copy jsdom's over the top of it.
  const nav = globalThis.navigator as unknown as { vibrate?: (n: number) => boolean };
  const had = Object.prototype.hasOwnProperty.call(nav, 'vibrate');
  const prior = nav.vibrate;
  const buzzes: number[] = [];
  Object.defineProperty(nav, 'vibrate', { value: (n: number) => { buzzes.push(n); return true; }, configurable: true });
  const doc = dom.window.document;
  try {
    for (const [pointerType, motion, want] of [
      ['touch', '', 1], ['mouse', '', 0], ['touch', 'reduce', 0],
    ] as const) {
      buzzes.length = 0;
      if (motion) doc.documentElement.setAttribute('data-a11y-motion', motion);
      else doc.documentElement.removeAttribute('data-a11y-motion');
      const h = mount([clip('a', 0, 3), clip('b', 3, 2), overlay('o', 0, 2)]);
      try {
        const el = h.bar('o');
        const grabAt = 50;
        el.dispatchEvent(pointer('pointerdown', grabAt, { pointerType }));
        h.root.dispatchEvent(pointer('pointermove', grabAt + 118, { pointerType }));
        await frames(3);
        // Still snapped to the SAME candidate: engaged once, felt once.
        h.root.dispatchEvent(pointer('pointermove', grabAt + 120, { pointerType }));
        await frames(3);
        h.root.dispatchEvent(pointer('pointerup', grabAt + 120, { pointerType }));
        assert.equal(buzzes.length, want, `${pointerType}${motion ? ` + ${motion}d motion` : ''}`);
        if (want) assert.deepEqual(buzzes, [8], 'one 8ms tick, not a buzz per frame');
      } finally { h.teardown(); }
    }
  } finally {
    doc.documentElement.removeAttribute('data-a11y-motion');
    if (had) Object.defineProperty(nav, 'vibrate', { value: prior, configurable: true });
    else delete (nav as Record<string, unknown>).vibrate;
  }
});

test('a keyboard trim that hits a wall costs no undo entry - but still reads back', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    const el = armKeys(h, 'a', 60);
    press(el, '[');                     // aim at the in edge; there is no source behind it
    press(el, ',');                     // pull left: refused, clipIn is already 0
    assert.equal(h.commits.length, 0, 'a refused nudge writes nothing at all');
    press(el, '.');                     // and the working direction still writes once
    assert.equal(h.commits.length, 1);
    assert.equal(Number(h.commits[0]!.find((x) => x.id === 'a')!.clipIn), 0.033);
  } finally { h.teardown(); }
});

// ── the clip inspector's grouped disclosure (plans/104 section 8) ────────────────────
//
// The row this replaced was eleven labelled inputs in a horizontal overflow scroller,
// and the keyframe row would have made it fourteen. It is now THREE groups - Time,
// Animate, Keyframes - each a disclosure button whose SHUT state reads as the resolved
// values, with the controls that produced them one press away. (Sound was a fourth
// until section 8's M2.6 pass: mute is one bit, so it is a toggle on the strip rather than a
// door onto a switch, and the A/V link went back to the clip context menu.)
//
// Three properties these pin, because all three are contracts rather than looks:
// the disclosure is a real `aria-expanded` button (the diamonds M2 hangs off the clip
// bars are aria-hidden pointer sugar - a `role="option"` may not carry interactive
// children - so the inspector IS the keyboard and screen-reader route); the collapse
// state is session UI state that survives the constant rebuilds a field edit causes
// and never reaches the model or storage; and the Keyframes group does not exist at
// all for a box with no track, which is plan 51's "nobody keyframes by accident" law.

/** One group wrapper by id, asserted present. */
function group(root: HTMLElement, gid: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(`.tl-inspector .tl-group[data-group="${gid}"]`);
  assert.ok(el, `the inspector has a "${gid}" group (got ${JSON.stringify(
    Array.from(root.querySelectorAll<HTMLElement>('.tl-inspector .tl-group')).map((g) => g.dataset.group))})`);
  return el!;
}

const groupHead = (root: HTMLElement, gid: string): HTMLButtonElement =>
  group(root, gid).querySelector('.tl-group-head') as HTMLButtonElement;

/** The collapsed value summary of one group, chip by chip. */
const groupChips = (root: HTMLElement, gid: string): string[] =>
  Array.from(group(root, gid).querySelectorAll('.tl-group-chip')).map((c) => c.textContent ?? '');

/** The open group popover - BODY-mounted, so it is not a descendant of the panel. */
const groupPopEl = (): HTMLElement | null =>
  dom.window.document.querySelector<HTMLElement>('.tl-group-pop');

/**
 * A group's BODY, wherever it currently lives: inside its own segment while the group
 * is shut, lent to the popover while it is open. Resolved through `aria-controls`,
 * which is the same edge a screen reader follows.
 */
function groupBody(root: HTMLElement, gid: string): HTMLElement {
  const id = groupHead(root, gid).getAttribute('aria-controls') ?? '';
  const el = dom.window.document.getElementById(id);
  assert.ok(el, `the "${gid}" group has a body (aria-controls="${id}")`);
  return el as HTMLElement;
}

/** Anything the inspector renders, in EITHER scope - the strip or the popover. */
const inspEl = <T extends Element>(sel: string): T | null =>
  dom.window.document.querySelector<T>(`.tl-inspector ${sel}, .tl-group-pop ${sel}`);
const inspAll = <T extends Element>(sel: string): T[] =>
  Array.from(dom.window.document.querySelectorAll<T>(`.tl-inspector ${sel}, .tl-group-pop ${sel}`));

/**
 * Force one group's disclosure. There is exactly ONE popover, so opening a second
 * group swaps rather than adding - every test below states the state it needs rather
 * than assuming what the last one left behind.
 */
function setGroup(root: HTMLElement, gid: string, open: boolean): HTMLButtonElement {
  const head = groupHead(root, gid);
  if ((head.getAttribute('aria-expanded') === 'true') !== open) head.click();
  assert.equal(head.getAttribute('aria-expanded'), open ? 'true' : 'false', `${gid} is ${open ? 'open' : 'shut'}`);
  return head;
}

test('the inspector renders GROUPS, each an icon + a text label + a disclosure button', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.select(['a']);
    assert.deepEqual(
      Array.from(h.root.querySelectorAll<HTMLElement>('.tl-inspector .tl-group')).map((g) => g.dataset.group),
      ['time', 'animate'],
      'a plain timed clip gets Time and Animate - no Keyframes, which it has not earned, '
      + 'and no Sound, which section 8\'s M2.6 pass turned into a plain toggle on the strip',
    );
    for (const gid of ['time', 'animate']) {
      const head = groupHead(h.root, gid);
      assert.equal(head.tagName, 'BUTTON', `${gid}: a real button, reachable by Tab`);
      assert.equal(head.type, 'button', `${gid}: never a submit`);
      assert.ok(head.querySelector('.tl-group-icon svg'), `${gid}: carries a registry glyph`);
      assert.equal(head.querySelector('.tl-group-icon svg')!.getAttribute('aria-hidden'), 'true',
        `${gid}: the icon DECORATES - the accessible name is the text label`);
      const label = head.querySelector('.tl-group-label')?.textContent ?? '';
      assert.ok(label.length > 0, `${gid}: icons never replace the word`);
      assert.ok(head.hasAttribute('aria-expanded'), `${gid}: says whether it is open`);
      const body = group(h.root, gid).querySelector('.tl-group-body') as HTMLElement;
      assert.ok(body.id, `${gid}: the body has an id`);
      assert.equal(head.getAttribute('aria-controls'), body.id, `${gid}: aria-controls points at that body`);
    }
    // Every id is unique - the row is rebuilt on every commit, and a duplicated
    // aria-controls target would point half the headers at someone else's fields.
    const ids = Array.from(h.root.querySelectorAll('.tl-group-body')).map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, 'body ids are unique');

    // The fields did not merely survive - they landed in the right group.
    const inGroup = (gid: string, label: string): boolean => Array.from(
      group(h.root, gid).querySelectorAll<HTMLElement>('.tl-group-body .tl-field'),
    ).some((r) => r.querySelector('.field-label')?.textContent === label);
    for (const label of ['Start', 'Length', 'Trim in', 'Speed']) {
      assert.ok(inGroup('time', label), `${label} is in Time`);
    }
    for (const label of ['Enter', 'Enter (ms)', 'Enter curve', 'Exit', 'Exit (ms)', 'Exit curve']) {
      assert.ok(inGroup('animate', label), `${label} is in Motion`);
    }
    // And the things that are NOT groups are direct children of the strip: the mute
    // toggle (M2.6) and the timed ⇄ always-on switch.
    assert.ok(h.root.querySelector('.tl-inspector > .tl-mute'), 'mute is a segment-less toggle on the strip');
    assert.equal(h.root.querySelector('.tl-group[data-group="sound"]'), null, 'and there is no Sound group to open');
    assert.ok(timingBtn(h.root), 'the timed ⇄ always-on switch is still a direct child affordance');
    assert.equal(h.root.querySelector('.tl-inspector > .tl-timing')?.tagName, 'BUTTON',
      'the toggle did not get swept into a group');
  } finally { h.teardown(); }
});

test('a shut group reads as its values: the summary chips', async () => {
  const h = mount([
    clip('a', 0, 3),
    { ...clip('b', 3, 2), enter: 'rise', enterMs: 400, enterEase: 'ease-out', exit: 'fade' } as Box,
  ]);
  try {
    h.select(['b']);
    // Time: where it starts, how long it runs, how fast - formatted by the SAME
    // fmtTime/fmtDur the transport pill and the trim badge use, and spelled out here
    // rather than re-derived, so a change to either formatter has to be looked at.
    // TIME keeps its numeric readout: it is the primary glance value of a clip, and
    // section 8's M2.6 pass names it as the one segment that stays as it was.
    assert.deepEqual(groupChips(h.root, 'time'), ['0:03.0', '2.0s', '×1']);
    assert.equal(fmtDur(2), '2.0s', 'the chip is the panel\'s own duration vocabulary');
    // Animate: the two KIND names, ONE chip, one separator dot - and nothing else.
    // M2.5 printed `In: Rise · 400ms · Ease out` / `Out: Cut (no animation)`, which is
    // every field of the group re-rendered on the door of the group ("chips must not
    // duplicate the popup's contents", section 8 M2.6).
    assert.deepEqual(groupChips(h.root, 'animate'), ['Rise · Fade']);
    const chip = groupChips(h.root, 'animate').join('');
    assert.equal(/\d/.test(chip), false, 'no ms anywhere in it');
    assert.equal(/[Ee]ase|[Cc]urve/.test(chip), false, 'and no curve name');
    assert.equal(chip.split('·').length, 2, 'exactly ONE separator dot');
    // The ms and the curve did not vanish from the UI - they are one press away, which
    // is the whole trade this pass makes.
    setGroup(h.root, 'animate', true);
    assert.equal(field(h.root, 'Enter (ms)').value, '400', 'the number lives in the popup');
    assert.equal(easeSel(h.root, 'Enter curve').value, 'ease-out', 'and so does the curve');

    // Changing a kind still moves the chip: it is a summary of the model, not a label.
    pick(easeSel(h.root, 'Exit'), 'none');
    h.notify();
    await frames(3);
    assert.deepEqual(groupChips(h.root, 'animate'), ['Rise'],
      'a CUT contributes nothing - never a placeholder, never an em dash');
  } finally { closeOverlays(); h.teardown(); }

  // Both directions cut - the state an untouched box is in - reads as NO chip at all.
  const plain = mount([clip('a', 0, 3)]);
  try {
    plain.select(['a']);
    assert.deepEqual(groupChips(plain.root, 'animate'), [],
      'nothing animated, nothing to say: the segment is a door, not a report');
  } finally { plain.teardown(); }
});

test('an UNTIMED box opens Time (the only promotion route there is) and summarises as Always on', () => {
  const h = mount([clip('a', 0, 3), scenery('s')]);
  try {
    h.select(['s']);
    assert.deepEqual(
      Array.from(h.root.querySelectorAll<HTMLElement>('.tl-inspector .tl-group')).map((g) => g.dataset.group),
      ['time', 'animate'],
    );
    // No mute toggle either: there is nothing playing to silence.
    assert.equal(h.root.querySelector('.tl-inspector .tl-mute'), null);
    assert.deepEqual(groupChips(h.root, 'time'), ['Always on']);
    // SHUT - like every group since section 8's M2.5 revision. Nothing auto-discloses on a
    // selection: a popover that opens itself over the canvas because you clicked a box
    // is a popover you then have to dismiss.
    assert.equal(groupHead(h.root, 'time').getAttribute('aria-expanded'), 'false');
    assert.equal(groupBody(h.root, 'time').hidden, true);
    // The one-press promotion route is not behind that disclosure at all - it is the
    // switch at the end of the strip, which is why shutting Time costs nothing.
    assert.equal(timingBtn(h.root).textContent, 'Add to the timeline');
    // And the typed route is one press away, still empty.
    setGroup(h.root, 'time', true);
    assert.equal(field(h.root, 'Start').value, '', 'the promotion field is right there, still empty');
    assert.equal(groupBody(h.root, 'time').parentElement?.className, 'tl-group-pop-body',
      'and it is in the POPOVER, not squeezed into the strip');
    closeOverlays();
  } finally { h.teardown(); }
});

test('the disclosure opens a POPOVER above the transport, and writes nothing', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const head = setGroup(h.root, 'animate', false);
    const body = groupBody(h.root, 'animate');
    const chips = group(h.root, 'animate').querySelector('.tl-group-chips') as HTMLElement;
    assert.equal(body.hidden, true, 'shut: the fields are out of the picture AND the a11y tree');
    assert.equal(body.parentElement, group(h.root, 'animate'), 'shut: the body waits in its own segment');
    assert.equal(groupPopEl(), null, 'shut: there is no popover in the document at all');
    assert.equal(head.getAttribute('aria-haspopup'), 'dialog', 'the segment says what it opens');

    head.click();
    const pop = groupPopEl();
    assert.ok(pop, 'open: a popover was mounted');
    assert.equal(pop!.getAttribute('role'), 'dialog');
    // NAMED FOR THE GROUP it is showing. All four groups open this one popover, so a
    // dialog that always announced the same constant never told a screen-reader user
    // which one they had just opened.
    assert.equal(pop!.getAttribute('aria-label'), 'Motion');
    assert.equal(pop!.parentElement, dom.window.document.body,
      'on the BODY, never inside the panel - .tl-panel is a transformed/clipping ancestor and a '
      + 'fixed popover parented under it would be positioned against the wrong containing block');
    assert.equal(head.getAttribute('aria-expanded'), 'true');
    assert.equal(body.hidden, false, 'open: the controls are reachable');
    assert.ok(pop!.contains(body), 'open: and they are INSIDE the popover, not in the strip');
    // The segment is a constant width whether the group is open or shut, which is the
    // whole reason the body left: the strip used to reflow around whichever group was
    // disclosed, and the ease pickers were capped to 11ch to survive it.
    assert.equal(chips.hidden, false, 'the chips are the segment\'s reading, open or shut');
    assert.equal(group(h.root, 'animate').classList.contains('is-open'), true);

    head.click();
    assert.equal(head.getAttribute('aria-expanded'), 'false');
    assert.equal(groupPopEl(), null, 'pressing the segment again shuts it');
    assert.equal(body.hidden, true);
    assert.equal(body.parentElement, group(h.root, 'animate'),
      'and the body came HOME - left inside the removed popover it would be a live node '
      + 'nobody can see, still being written to by the latch');

    assert.equal(h.commits.length, 0, 'a disclosure is not an edit - three presses, zero undo steps');
  } finally { closeOverlays(); h.teardown(); }
});

test('ONE popover at a time: opening another group swaps, and Esc closes it', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    setGroup(h.root, 'time', true);
    assert.ok(groupPopEl()!.contains(groupBody(h.root, 'time')));

    groupHead(h.root, 'animate').click();
    assert.equal(dom.window.document.querySelectorAll('.tl-group-pop').length, 1, 'still exactly one');
    assert.ok(groupPopEl()!.contains(groupBody(h.root, 'animate')), 'showing the group just pressed');
    assert.equal(groupHead(h.root, 'time').getAttribute('aria-expanded'), 'false', 'the other one shut');
    assert.equal(groupBody(h.root, 'time').hidden, true);
    assert.equal(groupBody(h.root, 'time').parentElement, group(h.root, 'time'), 'and took its body back');

    // Escape is the popover primitive's own (mountBodyPopover binds it on the document),
    // which is exactly why the body has to be handed back on EVERY close route, not just
    // on the one this module drives.
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(groupPopEl(), null, 'Esc closes it');
    assert.equal(groupBody(h.root, 'animate').parentElement, group(h.root, 'animate'),
      'and the body is back in its segment, not detached inside a removed popover');
    assert.equal(groupHead(h.root, 'animate').getAttribute('aria-expanded'), 'false');
    assert.equal(h.commits.length, 0);
  } finally { closeOverlays(); h.teardown(); }
});

test('the popover is placed ABOVE the transport, never dropped into the tracks', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    // jsdom has no layout, so the two rects and the popover's own size are stubbed - 
    // which is exactly what the placement reads and nothing more.
    h.root.getBoundingClientRect = (() => ({ top: 500, left: 0, right: 900, bottom: 700, width: 900, height: 200, x: 0, y: 500, toJSON: () => ({}) })) as never;
    h.select(['a']);
    const head = groupHead(h.root, 'animate');
    head.getBoundingClientRect = (() => ({ top: 505, left: 300, right: 380, bottom: 525, width: 80, height: 20, x: 300, y: 505, toJSON: () => ({}) })) as never;
    head.click();
    const pop = groupPopEl()!;
    Object.defineProperty(pop, 'offsetHeight', { value: 160, configurable: true });
    Object.defineProperty(pop, 'offsetWidth', { value: 300, configurable: true });
    dom.window.dispatchEvent(new dom.window.Event('resize'));   // re-runs the placement

    // The panel is docked at the BOTTOM of the stage, so "below the anchor" - the
    // popover primitive's own default - would open into the tracks the fields exist to
    // edit, and off the bottom of a short window. Bottom-aligned to the panel's top edge.
    assert.equal(pop.style.top, '332px', '500 (panel top) − 160 (its height) − 8 (the gap)');
    assert.equal(pop.style.left, '300px', 'and aligned to the near edge of the segment that opened it');
  } finally { closeOverlays(); h.teardown(); }
});

test('closing the panel takes the popover with it - it floats ABOVE the panel', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    setGroup(h.root, 'animate', true);
    assert.ok(groupPopEl());
    h.panel.setOpen(false);
    assert.equal(groupPopEl(), null,
      'a settings card left floating over the canvas with nothing under it explains nothing');
  } finally { closeOverlays(); h.teardown(); }
});

test('the popover survives the rebuild a model edit causes, and never reaches the model', () => {
  const h = mount([clip('a', 0, 3), clip('b', 3, 2)]);
  try {
    h.select(['a']);
    setGroup(h.root, 'time', true);
    const before = Object.keys(h.boxes.find((x) => x.id === 'a')!).sort();

    // A field edit rebuilds the whole inspector row from scratch - which destroys the
    // very segment the popover is anchored to AND the body it is showing. Without the
    // re-point, the popover would be left holding a detached body and Escape would
    // restore focus to a node that is no longer in the document.
    type(field(h.root, 'Length'), '2');
    h.notify();
    assert.equal(h.commits.length, 1);
    assert.ok(groupPopEl(), 'the popover is still up after the commit that rebuilt the row');
    assert.equal(groupHead(h.root, 'time').getAttribute('aria-expanded'), 'true');
    const body = groupBody(h.root, 'time');
    assert.ok(groupPopEl()!.contains(body), 'showing the FRESHLY built body, not the detached one');
    assert.ok(h.root.contains(groupHead(h.root, 'time')), 'anchored to the segment that replaced it');
    assert.equal(field(h.root, 'Length').value, '2', 'and it reads the value that was just written');

    // Session UI state, not a box field: the commit carries the length and nothing else.
    assert.deepEqual(Object.keys(h.commits[0]!.find((x) => x.id === 'a')!).sort(), before,
      'no disclosure key was invented on the box');

    // The popover belongs to the BOX it was opened on. Selecting another one shuts it
    // rather than silently re-pointing at a different clip's fields.
    h.select(['b']);
    assert.equal(groupPopEl(), null, 'a new selection is a new subject, so the card closes');
    assert.equal(groupHead(h.root, 'time').getAttribute('aria-expanded'), 'false');
  } finally { closeOverlays(); h.teardown(); }
});

test('the disclosure is SESSION-local: nothing about it is written to storage', async () => {
  // Onion skin next door IS persisted (readOnionPref / writeOnionPref), so "the panel
  // does not use storage" would be a false reading of a green test. This one runs the
  // disclosure under a fake store and asserts the store stays empty.
  const store = fakeStorage();
  await withStorage(store, async () => {
    const h = mount([clip('a', 0, 3)]);
    try {
      h.select(['a']);
      setGroup(h.root, 'time', false);
      setGroup(h.root, 'animate', true);
      setGroup(h.root, 'time', true);
      assert.equal(store.map.size, 0,
        `the disclosure wrote ${JSON.stringify([...store.map.keys()])} - a group left open is a working posture, `
        + 'not a setting, and reviving it a week later would be someone else\'s inspector');
    } finally { closeOverlays(); h.teardown(); }
  });
});

test('a static box gets the DOOR and nothing else - nobody keyframes by accident', () => {
  const kfCfg = { cfgPatch: { kfField: 'kf' } };
  const plain = mount([clip('a', 0, 3)], 40, ADD_KINDS, kfCfg);
  try {
    plain.select(['a']);
    // The disclosure law (plans/51:80, restated by 104 section 8) is satisfied by the group
    // being SHUT around a single action, not by the door being unreachable: a feature
    // with no way in is not progressive disclosure, it is an unshipped feature.
    const g = group(plain.root, 'keyframes');
    assert.equal(groupHead(plain.root, 'keyframes').getAttribute('aria-expanded'), 'false',
      'shut by default on a content box');
    assert.deepEqual(groupChips(plain.root, 'keyframes'), ['Not animated']);
    setGroup(plain.root, 'keyframes', true);
    const body = groupBody(plain.root, 'keyframes');
    assert.ok(groupPopEl()!.contains(body), 'the body opened in the popover, not in the strip');
    assert.deepEqual(
      Array.from(body.children).map((c) => c.textContent),
      ['Animate'],
      'ONE action behind the disclosure - no latch, no list until there is a track',
    );
    assert.equal(plain.root.querySelector('.tl-kf-strip'), null, 'and no diamonds on the bar');
    assert.equal(g.querySelector('.tl-group-chips')!.textContent, 'Not animated');
  } finally { closeOverlays(); plain.teardown(); }

  // A track is the door. Animate is DERIVED, never stored: the gate reads the field.
  const animated = mount([{ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box], 40, ADD_KINDS, kfCfg);
  try {
    animated.select(['a']);
    assert.ok(group(animated.root, 'keyframes'), 'a box with a track carries the group');
    assert.deepEqual(groupChips(animated.root, 'keyframes'), ['2 keyframes']);
    setGroup(animated.root, 'keyframes', true);
    assert.equal(inspAll('.tl-kf-list .tl-kf-row').length, 2, 'one CRUD row per diamond');
    assert.equal(inspEl('.tl-kf-animate'), null, 'the door is gone once it is open');
  } finally { closeOverlays(); animated.teardown(); }

  // Junk in the field cannot take the inspector down with it: parseKf never throws.
  const junk = mount([{ ...clip('a', 0, 3), kf: '"><img src=x>' } as Box], 40, ADD_KINDS, kfCfg);
  try {
    junk.select(['a']);
    assert.deepEqual(groupChips(junk.root, 'keyframes'), ['Not animated']);
  } finally { closeOverlays(); junk.teardown(); }

  // A camera is nothing BUT animation, so it is born DISCLOSED even with no track.
  const cam = mount([{ ...clip('c', 0, 3), kind: 'camera' } as Box], 40, ADD_KINDS, kfCfg);
  try {
    cam.select(['c']);
    assert.ok(group(cam.root, 'keyframes'), 'a camera always shows it');
    assert.deepEqual(groupChips(cam.root, 'keyframes'), ['Not animated']);
    setGroup(cam.root, 'keyframes', true);
    // The group's OWN "+Keyframe" is gone: section 8's M2.5 revision gave the action two homes
    // (the transport's additive cluster and the canvas contextual bar) and neither of
    // them is behind a disclosure. The latch READOUT is what the group keeps.
    assert.equal(inspEl('.tl-kf-add'), null, 'no third copy of the action hidden in here');
    assert.ok(inspEl('.tl-kf-state'), 'the latch readout stays');
    assert.equal(inspEl('.tl-kf-animate'), null, 'a camera is never offered the door - it IS animation');
    assert.equal(inspEl('.tl-kf-clear'), null, 'nothing to remove yet');
    assert.equal(cam.root.querySelector('.tl-kf-btn')!.getAttribute('aria-disabled'), 'false',
      'and the transport button is live for it');
  } finally { closeOverlays(); cam.teardown(); }

  // A tool whose manifest declares no kf sub-field never grows one out of nothing - 
  // the same progressive-capability gate `linkField` and the ease fields already carry.
  const noField = mount([{ ...clip('a', 0, 3), kf: 't0_x0*t900_x40' } as Box]);
  try {
    noField.select(['a']);
    assert.equal(noField.root.querySelector('.tl-inspector .tl-group[data-group="keyframes"]'), null);
  } finally { noField.teardown(); }
});

test('a no-track box surfaces Depth directly - it writes the box z, not a keyframe (A5#1)', () => {
  // Depth is a box PROPERTY, and standing a lifted layer off the board is parallax setup,
  // not animation - so it should not cost a keyframe track to reach. On a box with no
  // track the Depth control now sits beside the Animate door (KF_CFG declares `zField`),
  // and setting it writes the box's `z` through the same base path the pose row uses off a
  // diamond: it mints the scene camera (depth needs one to be seen) but NO track - section 8's
  // "nobody keyframes by accident" holds because a property write is not a keyframe.
  const depthCfg = { cfgPatch: { kfField: 'kf', zField: 'z' } };
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, depthCfg);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    const num = inspEl('.tl-depth-num') as HTMLInputElement;
    const slider = inspEl('.tl-depth-slider') as HTMLInputElement;
    assert.ok(num && slider, 'Depth is surfaced on a box with no track - no need to press Animate first');
    assert.ok(inspEl('.tl-kf-animate'), 'and the Animate door still stands beside it');
    assert.equal(inspEl('.tl-kf-list'), null, 'but there is no keyframe list - Depth is not a track');

    type(num, '120');
    const a = h.boxes.find((b) => b.id === 'a')!;
    assert.equal(Number(a.z), 120, 'the box gained a base depth from the property write');
    assert.equal(String(a.kf ?? ''), '', 'and NO keyframe track was minted - nobody keyframes by accident');
    assert.ok(h.boxes.some((b) => b.kind === 'camera'), 'the scene camera was minted so the depth can be seen');
    assert.equal(h.commits.length, 1, 'one gesture, one commit, one undo step');
  } finally { closeOverlays(); h.teardown(); }

  // A tool that declares NO depth field gets no Depth control - the same progressive gate.
  const noDepth = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { kfField: 'kf' } });
  try {
    noDepth.select(['a']);
    setGroup(noDepth.root, 'keyframes', true);
    assert.equal(inspEl('.tl-depth-slider'), null, 'no zField declared, no Depth control');
    assert.ok(inspEl('.tl-kf-animate'), 'just the Animate door, as before');
  } finally { closeOverlays(); noDepth.teardown(); }
});

test('a SOUND is offered no keyframe affordance anywhere - not a group, not a door, not a diamond', async () => {
  // section 8's disclosure law, the other way round: "Every other box has no keyframe affordance
  // anywhere in the UI - not a disabled one, not an empty one." `kfActionIds` excludes
  // audio (plan 101 owns keyframed gain), so an inspector that offered the group anyway
  // gave the user an Animate door onto exactly the x/y/s/r/o track "+Keyframe" refuses to
  // write and no evaluator reads. ONE predicate, every reader.
  const kfCfg = { cfgPatch: { kfField: 'kf' } };
  const h = mount(kfScene({ ...clip('snd', 0, 3), kind: 'audio', kf: 't0_x0*t1500_x40' } as Box), 40, ADD_KINDS, kfCfg);
  try {
    h.select(['snd']);
    assert.equal(h.root.querySelector('.tl-inspector .tl-group[data-group="keyframes"]'), null,
      'no Keyframes group - and therefore no Animate door to write the refused track');
    assert.equal(h.bar('snd').querySelector('.tl-kf-strip'), null,
      'and no diamonds on the waveform for a track nothing can reach');
    assert.equal(h.root.querySelector('.tl-kf-btn')!.getAttribute('aria-disabled'), 'true',
      'the button that refuses it says so, which is the state the rest must agree with');
    assert.equal(h.commits.length, 0);
  } finally { closeOverlays(); h.teardown(); }

  // The LIVE canvas half of the same rule: a box carrying an audio asset is a sound
  // whatever its `kind` says. This is the case a model-only gate lets through.
  const live = mount(kfScene({ ...clip('snd', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, ADD_KINDS, kfCfg);
  try {
    paintMediaBoxes(live, { snd: '<div class="lolly-box-audio" data-audio-src="vo.mp3" data-audio-dur="3000"></div>' });
    live.select(['snd']);
    assert.equal(live.root.querySelector('.tl-inspector .tl-group[data-group="keyframes"]'), null,
      'the canvas is the second source, and the inspector reads it too');
    assert.equal(live.root.querySelector('.tl-kf-btn')!.getAttribute('aria-disabled'), 'true');
  } finally { closeOverlays(); live.teardown(); }
});

test('a curve editor opened from INSIDE a group card does not dismiss the card', async () => {
  // The card is a body-mounted popover, and so is the curve editor it spawns - siblings
  // on <body>, so `menu.contains(target)` says false and the first press inside the editor
  // (a bezier handle, a preset) read as an outside click and closed the card mid-drag. It
  // took the borrowed group BODY with it, back into its segment with `hidden = true`, so
  // the <select> the editor restores focus to was inside a display:none subtree. That is
  // directive 3's own surface ("Ease selects get real width in the popover"): the flow the
  // revision exists to fix was the flow that broke.
  //
  // The ANIMATE group is the surface now: section 8's M2.7 docked the KEYFRAME curve editor
  // inside the Keyframes popup itself (one surface, no nested popover), so the
  // transition curves are what still spawn a `.tl-ease-pop` from inside a card - and
  // the `isInside` exemption that keeps the card up is the same one.
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'animate', true);
    const sel = inspAll<HTMLSelectElement>('.tl-ease')[0]!;
    pick(sel, '__custom');
    const ed = openMenu('.tl-ease-pop');
    assert.ok(ed, 'the keyframe curve editor opened');
    assert.ok(groupPopEl(), 'precondition: the card is still up');
    // The dismissal listener is registered on a timeout (so the opening click cannot
    // dismiss what it just opened) - a press before that proves nothing.
    await new Promise((r) => setTimeout(r, 0));

    (ed!.querySelector('.ease-ed-plot') as HTMLElement).dispatchEvent(pointer('pointerdown', 40));
    assert.ok(groupPopEl(), 'a press inside a popover the card SPAWNED is not an outside press');
    assert.equal(sel.closest('[hidden]'), null,
      'and the select the editor will restore focus to is still in a visible subtree');
    assert.ok(groupPopEl()!.contains(sel), 'because the borrowed body never went home');

    // One Escape, the innermost popover - both listen on `document`, so stopPropagation
    // cannot separate them; `isInside` is what does.
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(openMenu('.tl-ease-pop'), null, 'the editor closed');
    assert.ok(groupPopEl(), 'and only the editor - the card is not collateral');
    assert.equal(h.commits.length, 0, 'opened and abandoned: not an edit');
  } finally { closeOverlays(); h.teardown(); }
});

test('the A/V link is offered by the CLIP MENU alone - the inspector strip carries no copy', async () => {
  // section 8's M2.6 pass: "The link/detach affordance returns to the clip context menu (its
  // pre-M2 home)". M2.5 had put a second copy in the Sound group beside the mute, and
  // when that group became a bare toggle the copy had nowhere honest to live: detaching
  // audio grows a whole second bar on another lane, which is not a sibling of a mute
  // switch. The writers are unchanged and still one commit each - what moved is the door.
  const h = mount([clip('v', 0, 4)], 40, ADD_KINDS, { linkField: 'linkOf' });
  try {
    // The canvas says this clip is a video, which is what makes a detach mean anything.
    paintVideo(h, 'v');
    h.panel.setOpen(false); h.panel.setOpen(true);
    h.select(['v']);
    assert.equal(h.root.querySelector('.tl-inspector .tl-detach'), null, 'no detach on the strip');
    assert.equal(h.root.querySelector('.tl-inspector .tl-relink'), null, 'and no re-attach either');
    assert.ok(h.root.querySelector('.tl-inspector .tl-mute'), 'the strip keeps the mute toggle, and only that');

    // The menu route still works, still writes once, and still shows the inverse after.
    rightClick(h.bar('v'));
    const detach = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim().startsWith('Detach audio')) as HTMLElement;
    assert.ok(detach, 'the clip menu offers it');
    click(detach);
    assert.equal(h.commits.length, 1, 'ONE commit - the same writer the strip used to call');
    h.notify();
    await frames(3);
    h.select(['v']);
    assert.ok(ctxLabels(h, 'v').some((l) => l.startsWith('Re-attach audio')), 'and the way back is in the same menu');
  } finally { closeOverlays(); h.teardown(); }
});

// ── mute: a toggle, not a group (plans/104 section 8's M2.6 pass) ────────────────────
//
// "SOUND stops being a popover group entirely: it becomes a speaker/mute icon toggle
// on the strip (direct click flips mute - the NLE convention), no popup."
//
// Three things are pinned, and each is a rule rather than a look: the button IS the
// state (`aria-pressed` + the glyph, so a screen reader and an eye read the same bit);
// a press is ONE model write through the SAME field the rest of the panel mutes with;
// and there is no popover anywhere on the path, because a disclosure onto a single
// switch is a door onto a door.

/** The inspector's speaker toggle - a direct child of the strip, never inside a group. */
const muteBtn = (h: Harness): HTMLButtonElement => {
  const b = h.root.querySelector('.tl-inspector > .tl-mute') as HTMLButtonElement;
  assert.ok(b, 'the inspector carries the mute toggle');
  return b;
};

test('the mute toggle IS its state: aria-pressed, the flipped glyph and the flipped name', async () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const b = muteBtn(h);
    assert.equal(b.tagName, 'BUTTON', 'a real button, reachable by Tab');
    assert.equal(b.type, 'button', 'never a submit');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'audible: not pressed');
    assert.equal(b.getAttribute('aria-label'), 'Mute clip', 'named for the ACTION the press performs');
    assert.equal(b.title, 'Mute clip',
      'a title, not a [data-tip] bubble: .tl-inspector is an overflow scroller and would clip one');
    assert.equal(b.getAttribute('data-tip'), null);
    assert.ok(b.querySelector('svg'), 'the glyph is a registry icon, never a CSS drawing');
    assert.equal(b.querySelector('svg')!.getAttribute('aria-hidden'), 'true',
      'and it DECORATES - aria-label is the whole accessible name');
    const audible = b.innerHTML;
    assert.equal(b.getAttribute('aria-haspopup'), null, 'it opens nothing');

    b.click();
    assert.equal(h.commits.length, 1, 'ONE model write per press - one gesture, one undo step');
    assert.equal(h.commits[0]!.find((x) => x.id === 'a')!.mute, 'true',
      'through the manifest\'s own mute sub-field, the same one the ctx menu and the detach writer use');
    assert.deepEqual(h.commits[0]!.map((x) => x.id), ['a'], 'and it touched nothing else');
    assert.equal(dom.window.document.querySelector('.tl-group-pop'), null, 'no popover was ever mounted');

    h.notify();
    await frames(3);
    const after = muteBtn(h);
    assert.equal(after.getAttribute('aria-pressed'), 'true', 'pressed means SILENT');
    assert.equal(after.getAttribute('aria-label'), 'Unmute clip', 'and the name is now the way back');
    assert.equal(after.title, 'Unmute clip');
    assert.notEqual(after.innerHTML, audible, 'the speaker glyph flipped to speaker-off');

    // And back, through the same one writer: a toggle that could only be pressed one
    // way would leave a clip silent with no way out but the URL.
    after.click();
    assert.equal(h.commits.length, 2);
    assert.equal(h.commits[1]!.find((x) => x.id === 'a')!.mute, '', 'unmuted is the EMPTY field, not "false"');
    h.notify();
    await frames(3);
    assert.equal(muteBtn(h).getAttribute('aria-pressed'), 'false');
  } finally { h.teardown(); }
});

test('the mute toggle tracks the MODEL, not the press that changed it', async () => {
  // A clip that is born muted paints pressed on first render - the button reads the row
  // rather than a latched local flag, which is what makes it agree with a mute written
  // from anywhere else (the detach writer silences the picture it takes the sound off).
  const h = mount([{ ...clip('a', 0, 3), mute: 'true' } as Box]);
  try {
    h.select(['a']);
    assert.equal(muteBtn(h).getAttribute('aria-pressed'), 'true');
    assert.equal(muteBtn(h).getAttribute('aria-label'), 'Unmute clip');
    assert.equal(h.commits.length, 0, 'rendering a control is never an edit');
  } finally { h.teardown(); }
});

test('the groups work right-to-left', () => {
  // jsdom has no layout, so this is the honest half: the markup survives a dir flip and
  // the SHEET carries a direction-aware caret plus logical box properties. A physical
  // `border-left` between two chips reads as a leading rule in Arabic, Hebrew, Farsi
  // and Urdu - four of the twenty-six languages this panel ships in.
  const doc = dom.window.document;
  doc.documentElement.dir = 'rtl';
  try {
    const h = mount([clip('a', 0, 3)]);
    try {
      h.select(['a']);
      assert.deepEqual(
        Array.from(h.root.querySelectorAll<HTMLElement>('.tl-inspector .tl-group')).map((g) => g.dataset.group),
        ['time', 'animate'], 'the row still builds under dir=rtl');
      // The mute toggle is an icon with no text at all, so RTL is the case where an
      // aria-label is not a nicety: it is the control's only name in any direction.
      const mute = h.root.querySelector('.tl-inspector > .tl-mute') as HTMLButtonElement;
      assert.ok(mute, 'and it still carries the mute toggle');
      assert.equal(mute.getAttribute('aria-label'), 'Mute clip');
      assert.equal(mute.getAttribute('aria-pressed'), 'false');
      const head = setGroup(h.root, 'time', false);
      head.getBoundingClientRect = (() => ({ top: 10, left: 300, right: 380, bottom: 30, width: 80, height: 20, x: 300, y: 10, toJSON: () => ({}) })) as never;
      head.click();
      assert.equal(head.getAttribute('aria-expanded'), 'true', 'and the disclosure still works');
      const pop = groupPopEl()!;
      assert.ok(pop, 'the popover opens under dir=rtl too');
      Object.defineProperty(pop, 'offsetWidth', { value: 300, configurable: true });
      Object.defineProperty(pop, 'offsetHeight', { value: 100, configurable: true });
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      // The card opens TOWARDS the segment that spawned it: right-aligned to its right
      // edge (380 − 300), not left-aligned to its left one, which in Arabic would open
      // it away from the button that was just pressed. Same rule as the `+` menu's.
      assert.equal(pop.style.left, '80px');
      closeOverlays();
    } finally { h.teardown(); }
  } finally { doc.documentElement.dir = ''; }

  const css = readFileSync(new URL('../styles/parts/timeline.css', import.meta.url), 'utf8');
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Sliced between two SELECTORS, never a comment: `decls` has had its comments
  // stripped, so a comment marker would find nothing and quietly widen the slice to the
  // rest of the sheet - a scan that reads everything asserts nothing about anything.
  const block = decls.slice(decls.indexOf('.tl-group {'), decls.indexOf('.tl-ruler {'));
  assert.ok(block.length > 200, 'the group block was found');
  assert.ok(/\[dir="rtl"\][^{]*\.tl-group-caret\s*\{[^}]*rotate\(90deg\)/.test(block),
    'the shut caret points along the READING direction, which flips in RTL');
  assert.equal(/(?:^|[\s;{])(?:border|margin|padding)-(?:left|right)\s*:/.test(block), false,
    'logical properties only - no physical left/right in the group block');
  assert.ok(block.includes('border-inline-start'), 'the chip separator is a logical border');
});

// ── the keyframe surface (plans/104 section 8, workstream I2) ───────────────────────
//
// Four things are pinned here, and each is a rule rather than a look:
//
//   1. DIAMONDS ARE POINTER SUGAR. A clip bar is `role="option"` inside a listbox,
//      where an interactive child is illegal, so the dots are aria-hidden `<span>`s
//      and every one of their actions is also a labelled button in the inspector.
//   2. THE LATCH. Scrubbing snaps the playhead onto the diamonds of SELECTED boxes,
//      Alt bypasses it, and the group header says which of the two states you are in.
//   3. PLAYHEAD-CONTEXTUAL WRITES. Parked ON a diamond an edit poses THAT keyframe as
//      a full pose; parked OFF one the track is not touched at all.
//   4. ONE WRITE PER GESTURE. A drag, a press and a button are each one commit and
//      therefore one undo step - the panel's own model-write law, extended to a
//      surface that edits a string field instead of a number one.
//
// The keyframe MATHS is not tested here: it is `engine/src/keyframes.ts` (goldens at
// the repo root) and `timeline-math.ts` (tests/timeline-math.test.ts). What this file
// owns is the glue - which is exactly the split the panel's header law describes.

const { parseKf: parse, KF_EASE_TOKENS, kfEaseName } = await import('../../../../engine/src/keyframes.ts');
// The shell's own word for each of those curves - the picker's labels are asserted
// against this registry rather than against transcribed strings, so a renamed preset
// moves in one place.
const { EASINGS } = await import('../lib/transitions.ts');

/**
 * sequence-studio's cfg plus the keyframe, depth and tilt sub-fields a keyframable tool
 * declares - the design tool's own set (`canvas.zField` / `rxField` / `ryField`), so the
 * pose row here is the six controls that ship rather than a subset.
 */
const KF_CFG = { cfgPatch: { kfField: 'kf', zField: 'z', rxField: 'rx', ryField: 'ry' } };

/**
 * One animated clip plus a plain second one, so the timeline is 5s long and the
 * panel's first-open fit lands on the 40px/s every rect stub in this file assumes.
 * (`mount` stubs the viewport at `24 + 5 * pxPerSecHint`; the zoom that fits is
 * `(width - 24) / total`, so a shorter total silently zooms in and every asserted
 * pixel below moves.)
 */
const kfScene = (box: Box): Box[] => [box, clip('z', 3, 2)];

/** The kf field of one box, straight out of the last commit. */
const kfOf = (h: Harness, id: string): string => String(h.boxes.find((b) => b.id === id)?.kf ?? '');

/** Park the playhead at `atMs` through the same `fc-seek` event free-canvas dispatches. */
async function seek(h: Harness, atMs: number): Promise<void> {
  h.stageEl.dispatchEvent(new dom.window.CustomEvent('fc-seek', { bubbles: true, detail: { atMs } }));
  await frames(3);
}

const dots = (h: Harness, id: string): HTMLElement[] =>
  Array.from(h.bar(id).querySelectorAll<HTMLElement>('.tl-kf-dot'));

test('diamonds: one aria-hidden span per keyframe, positioned like a seam chip, never interactive', () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    const strip = h.bar('a').querySelector('.tl-kf-strip') as HTMLElement;
    assert.ok(strip, 'an animated clip carries a strip');
    assert.equal(strip.getAttribute('aria-hidden'), 'true', 'the whole strip is out of the a11y tree');
    const d = dots(h, 'a');
    assert.equal(d.length, 2, 'one dot per keyframe');
    assert.deepEqual(d.map((n) => n.tagName), ['SPAN', 'SPAN'],
      'SPANs, not buttons: a role="option" bar may not own interactive children');
    // Local ms → bar-local px at 40px/s, exactly as `.tl-seam` maps a junction.
    assert.deepEqual(d.map((n) => n.style.left), ['0px', '60px']);
    assert.deepEqual(d.map((n) => n.dataset.t), ['0', '1500']);
    assert.equal(h.bar('a').querySelector('button, input, select, a[href]'), null,
      'and the bar still owns no focusable descendant of any kind');
  } finally { h.teardown(); }
});

test('diamonds are absent for a static box and hidden on a bar too tight to hit them on', () => {
  const h = mount([clip('a', 0, 3), { ...clip('b', 3, 0.5), kf: 't0_x0*t400_x9' } as Box, clip('c', 3.5, 1.5)], 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    assert.equal(h.bar('a').querySelector('.tl-kf-strip'), null, 'no track, no strip');
    // 0.5s at 40px/s is 20px, under MIN_TRIM_BAR_PX - the trim grips hide there too, and
    // for the same reason: a target you cannot land on is worse than no target. The
    // inspector list still lists every keyframe.
    const tight = h.bar('b').querySelector('.tl-kf-strip') as HTMLElement;
    assert.ok(tight, 'the strip is still built');
    assert.equal(tight.hidden, true, 'and hidden via the property - nothing in the sheet styles [hidden]');
  } finally { h.teardown(); }
});

test('the latch: a scrub snaps onto a selected clip\'s diamond, and Alt walks past it', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    const ruler = h.root.querySelector('.tl-ruler') as HTMLElement;
    const playhead = h.root.querySelector('.tl-playhead') as HTMLElement;

    // 63px = 1.575s, three pixels past the diamond at 1.5s and clear of every other
    // candidate (the clip's own edges at 0 and 3s, and the whole-second marks).
    ruler.dispatchEvent(pointer('pointerdown', 63));
    await frames(3);
    assert.equal(playhead.style.left, '60px', 'the playhead latched onto the diamond');

    h.root.dispatchEvent(pointer('pointerup', 63));
    await frames(3);
    assert.equal(playhead.style.left, '60px', 'and the release committed the same instant it previewed');

    // Alt is the universal snap bypass in this panel, and it means the same thing here.
    ruler.dispatchEvent(pointer('pointerdown', 63, { altKey: true }));
    await frames(3);
    assert.equal(playhead.style.left, '63px', 'Alt parks between diamonds');
    h.root.dispatchEvent(pointer('pointerup', 63, { altKey: true }));
    assert.equal(h.commits.length, 0, 'and a scrub is not an edit, however it lands');
  } finally { h.teardown(); }
});

test('the latch header flips No keyframe here ⇄ Keyframe @ …, and the pose fields follow it', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    const state = () => (inspEl('.tl-kf-state') as HTMLElement).textContent;
    const poseDisabled = () => inspAll<HTMLInputElement>('.tl-kf-pose-num').map((n) => n.disabled);

    await seek(h, 2000);
    assert.equal(state(), 'No keyframe here', 'parked between diamonds');
    // DEPTH AND THE TILT PAIR ARE THE EXCEPTION (section 5.3's depth slider, P2.1's tilt
    // rows): each is a pose channel with a base field of its own, so off a diamond an
    // edit there writes the BASE - section 8's own rule - rather than inventing a keyframe.
    // The other three have nothing to write and stay inert.
    assert.deepEqual(poseDisabled(), [false, false, false, true, true, true],
      'no keyframe to pose: everything but Depth and the tilts is inert (they still READ, see below)');
    assert.deepEqual(dots(h, 'a').map((n) => n.classList.contains('is-selected')), [false, false]);

    await seek(h, 1500);
    assert.equal(state(), 'Keyframe @ 0:01.5', 'parked ON one');
    assert.deepEqual(poseDisabled(), [false, false, false, false, false, false]);
    assert.deepEqual(dots(h, 'a').map((n) => n.classList.contains('is-selected')), [false, true],
      'and the diamond under the playhead draws large');
    assert.deepEqual(
      inspAll<HTMLElement>('.tl-kf-row').map((r) => r.classList.contains('is-current')),
      [false, true], 'the list marks the same one');
  } finally { closeOverlays(); h.teardown(); }
});

test('an on-diamond pose edit rewrites exactly ONE keyframe, as a full pose, in one commit', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 1500);
    // By CHANNEL, not by position: P2.1 put two tilt rows between Depth and Scale, and an
    // index here would have silently started driving a different control.
    const opacity = inspEl<HTMLInputElement>('.tl-kf-pose-num[data-ch="o"]')!;
    opacity.value = '0.5';
    opacity.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    assert.equal(h.commits.length, 1, 'ONE commit, therefore one undo step');
    const track = parse(kfOf(h, 'a'));
    assert.equal(track.length, 2, 'no keyframe was added');
    assert.deepEqual({ ...track[0]!.v }, { x: 0 }, 'the OTHER keyframe is untouched, sparse channels and all');
    // The edited one is now a FULL pose over the box's active channel set (section 8: "every
    // diamond is a complete honest pose") - x, which the track already animates, plus
    // the channel just edited. Its x is the value it already held, not a neutral.
    assert.deepEqual({ ...track[1]!.v }, { x: 40, o: 0.5 });
    assert.equal(track[1]!.ease, 'eo', 'and the curve out of it survives the edit');
  } finally { closeOverlays(); h.teardown(); }
});

test('parked OFF a diamond, nothing can write the track - the base is what an edit means there', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 2000);
    assert.deepEqual(h.panel.kfPoseIds(['a']), [],
      'the canvas seam reports nothing to redirect, so a drag moves the box as it always did');

    // The pose fields are inert, and driving one anyway (a change event on a disabled
    // control is not something a browser sends, but a test can) must still write nothing.
    // By CHANNEL, not by position: P2.1 put two tilt rows between Depth and Scale, and an
    // index here would have silently started driving a different control.
    const opacity = inspEl<HTMLInputElement>('.tl-kf-pose-num[data-ch="o"]')!;
    assert.equal(opacity.disabled, true);
    opacity.value = '0.25';
    opacity.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 0, 'a change on an off-diamond field commits nothing');
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_eo_x40', 'and mints no keyframe under the playhead');
    assert.equal(opacity.value, '1',
      'the refused edit is re-read from the model, so the field never shows a number nothing stored');

    // The scenario the commit-time latch check exists for. `disabled` is not a guard:
    // park ON a diamond, start typing, and let the playhead move before the edit commits
    // (a ruler scrub `preventDefault()`s, so the field keeps focus). The tick disables the
    // field, disabling a FOCUSED input blurs it, and the browser fires the pending
    // `change` on that blur - with the playhead now somewhere else entirely.
    await seek(h, 1500);
    const late = inspEl<HTMLInputElement>('.tl-kf-pose-num[data-ch="o"]')!;
    assert.equal(late.disabled, false, 'on the diamond it takes the typing');
    await seek(h, 2200);
    assert.equal(late.disabled, true, 'and the tick pulls the floor out from under the edit');
    late.value = '0.25';   // the number that was in the field when the blur committed it
    late.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 0, 'the late commit writes nothing');
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_eo_x40',
      'and no third keyframe at 2:200 - a value typed on a diamond can never mint one off it');

    // Exact ms equality, never a tolerance: one millisecond off a diamond is OFF it.
    await seek(h, 1501);
    assert.deepEqual(h.panel.kfPoseIds(['a']), []);
    await seek(h, 1500);
    assert.deepEqual(h.panel.kfPoseIds(['a']), ['a']);
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_eo_x40', 'and none of that scrubbing touched the model');
    assert.equal(h.commits.length, 0);
  } finally { closeOverlays(); h.teardown(); }
});

test('a CLOSED panel arms nothing: no playhead on screen, no redirection', async () => {
  // section 8's model is "the playhead's position IS the arm". `setOpen(false)` pauses the
  // clock but keeps its time, so without an explicit gate a canvas drag on an animated
  // box would still write a keyframe - with no latch header, no diamonds, no transport
  // and no "+Keyframe" anywhere to explain where it came from.
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    await seek(h, 1500);
    assert.deepEqual(h.panel.kfPoseIds(['a']), ['a'], 'armed while the panel is up');
    h.panel.setOpen(false);
    assert.deepEqual(h.panel.kfPoseIds(['a']), [],
      'and disarmed the moment the surface that shows the arm is gone');
    h.panel.setOpen(true);
    assert.deepEqual(h.panel.kfPoseIds(['a']), ['a'], 'the playhead never moved, so re-opening re-arms it');
  } finally { h.teardown(); }
});

test('the pose fields print at the channel quantum, EVALUATE off a diamond, and clamp Depth', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), z: 140, kf: 't0_z0*t1500_z300' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    const pose = (): HTMLInputElement[] => inspAll<HTMLInputElement>('.tl-kf-pose-num');
    const values = (): string[] => pose().map((n) => n.value);

    await seek(h, 1500);
    // Depth, Tilt X, Tilt Y, Scale, Opacity, Blur - the row order KF_POSE_FIELDS pins.
    assert.deepEqual(values(), ['300', '0', '0', '1', '1', '0'], 'on a diamond, the pose it holds');

    // OFF a diamond they are inert but NOT blank (section 8's M2.5 revision, point 3: blanking
    // was honest and read as broken). They print what the box is actually striking at
    // the playhead - `kfPoseAt` → the engine's own `evaluateKf`, the same arithmetic the
    // preview and the export read - so a disabled field is a live readout rather than a
    // hole. Halfway between z 0 and z 300 on the default ease is not the midpoint, which
    // is exactly why this number has to come from the engine and not from the panel.
    await seek(h, 750);
    const mid = values();
    assert.deepEqual(pose().map((n) => n.disabled), [false, false, false, true, true, true],
      'still inert - except Depth and the tilts, which have a base field to write (section 5.3)');
    assert.notDeepEqual(mid, ['', '', '', '', '', ''], 'and no longer blank');
    const z = Number(mid[0]);
    assert.ok(z > 0 && z < 300, `depth reads between its two diamonds (got ${mid[0]})`);
    assert.deepEqual(mid.slice(1), ['0', '0', '1', '1', '0'],
      'the channels the track never mentions read neutral - and an unauthored tilt is the flat card');

    // …and it TRACKS. The memo is keyed on the playhead's own millisecond, not on the
    // latch answer, which is the bug the blanking was covering for: keyed on the answer,
    // any number printed here froze at whatever the last diamond was.
    await seek(h, 1200);
    assert.ok(Number(values()[0]) > z, 'the readout moves with the playhead, it does not freeze');

    // `min`/`max` are the spinner's range, not a validator: a typed value commits
    // verbatim on `change`, and the engine's WIRE clamp for z is far wider than the
    // FIELD's (section 5.1). The inspector is a named `KF_Z_FIELD_CLAMP` enforcement site.
    await seek(h, 1500);
    const depth = pose()[0]!;
    depth.value = '5000';
    depth.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(kfOf(h, 'a'), 't0_z0*t1500_z900', 'clamped to the field range, not the wire range');
    assert.equal(h.commits.length, 1, 'and still one commit');
    const after = inspAll<HTMLInputElement>('.tl-kf-pose-num')[0]!;
    assert.equal(after.value, '900', 'the control is reflected back, so it cannot disagree with the model');
  } finally { closeOverlays(); h.teardown(); }
});

test('the "size is not keyframable" claim is GONE - w/h are channels now (section 5.2 reversed)', async () => {
  // P1 reversed it (Andy, 2026-08-12 hands-on: "I can't change width and height of
  // elements and have them tween"). The wire carries `w`/`h`, a resize ON a diamond
  // writes them, and a standing sentence - or a tooltip - saying otherwise is now a
  // lie in the one place a user goes to check. Size is still authored on the CANVAS,
  // which is why there is still no width field in here.
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    assert.equal(inspEl('.tl-kf-note'), null, 'the standing paragraph is gone');
    const wrap = inspEl<HTMLElement>('.tl-kf-pose');
    assert.ok(wrap, 'the pose fields are one block');
    assert.equal(wrap!.title, '', 'and the tooltip that claimed size could never tween went with it');
    assert.equal(inspAll('.tl-kf-pose .tl-kf-pose-num').length, 6, 'all six channels are inside it');
    // The depth slider is the fifth control on that block - the section 5.3 scrub band, beside
    // the number that still takes the whole field range.
    const slider = inspEl<HTMLInputElement>('.tl-kf-pose .tl-kf-slider');
    assert.ok(slider, 'Depth has a slider');
    assert.equal(slider!.type, 'range');
    assert.deepEqual([slider!.min, slider!.max], ['0', '300'], 'the tasteful band, not the clamp');
    const depth = inspAll<HTMLInputElement>('.tl-kf-pose-num')[0]!;
    assert.deepEqual([depth.min, depth.max], ['-300', '900'], 'the number takes KF_Z_FIELD_CLAMP');
  } finally { closeOverlays(); h.teardown(); }
});

test('the canvas seam writes one full-pose key per selected box, in ONE array the caller commits once', async () => {
  const h = mount([
    { ...clip('a', 0, 3), kf: 't0_x0_y0*t1500_x40_y0' } as Box,
    { ...overlay('b', 0, 3), kf: 't0_x0_y0*t1500_x-10_y5' } as Box,
    clip('z', 3, 2),
  ], 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a', 'b']);
    await seek(h, 1500);
    assert.deepEqual(h.panel.kfPoseIds(['a', 'b']), ['a', 'b'], 'both are parked on a diamond of their own');

    // 'add' semantics: a gesture's delta composes onto whatever the box was already
    // doing at this instant, because the channels are offsets and the user dragged
    // from where the box actually was.
    const next = h.panel.kfPoseWrite(h.boxes, ['a', 'b'], { x: 12, y: -4 });
    const ta = parse(String(next.find((x) => x.id === 'a')!.kf));
    const tb = parse(String(next.find((x) => x.id === 'b')!.kf));
    assert.deepEqual({ ...ta[1]!.v }, { x: 52, y: -4 });
    assert.deepEqual({ ...tb[1]!.v }, { x: 2, y: 1 });
    assert.deepEqual({ ...ta[0]!.v }, { x: 0, y: 0 }, 'the untouched keyframes stay untouched');
    assert.equal(h.commits.length, 0, 'and the seam itself never commits - the caller owns the write');
  } finally { h.teardown(); }
});

/** The transport's "+Keyframe" - the END of the left cluster, after the keyboard sheet. */
const kfBtn = (h: Harness): HTMLButtonElement => {
  const b = h.root.querySelector('.tl-tools .tl-kf-btn') as HTMLButtonElement;
  assert.ok(b, 'the transport carries a +Keyframe button');
  return b;
};

test('+Keyframe sits at the END of the transport cluster, and says when it can do nothing', () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    const b = kfBtn(h);
    // The WHOLE cluster, in order - pinned end to end rather than by a slice, because
    // the position of this one button is the assertion. section 8's M2.6 pass moved it out of
    // the additive/recording cluster to the tail, AFTER the keyboard sheet:
    // `… zoom− zoom+ expand ⌨ ◇`.
    // The IDENTITY class only (`classList[1]`, the token `btn()` mints after `tl-btn`) - 
    // a state class like `.is-active` on the snap button is not part of the ordering.
    const cluster = Array.from(h.root.querySelectorAll<HTMLElement>('.tl-tools > .tl-btn'))
      .map((x) => x.classList[1]);
    assert.deepEqual(cluster, [
      'tl-screen', 'tl-add', 'tl-mic', 'tl-cam', 'tl-script', 'tl-transcript', 'tl-split', 'tl-snap', 'tl-onion',
      'tl-zoom-out', 'tl-zoom-in', 'tl-fit', 'tl-keys', 'tl-mobile-tools', 'tl-kf-btn',
    ], 'the diamond is LAST - never back among +, mic, camera and script');
    assert.equal(cluster.at(-1), 'tl-kf-btn', 'and nothing may be appended after it');
    assert.ok(b.querySelector('svg'), 'it is the diamond glyph');

    // DISABLED, not hidden: a control that vanishes as you click around teaches nothing,
    // and this one is the answer to "how do I animate this".
    assert.equal(b.getAttribute('aria-disabled'), 'true', 'nothing selected, nothing to key');
    assert.equal(b.hidden, false, 'and it is still there to be read');
    assert.equal(b.getAttribute('aria-label'), 'Select something on the canvas to keyframe it');
    b.click();
    assert.equal(h.commits.length, 0, 'pressing it anyway writes nothing');

    h.select(['a']);
    assert.equal(b.getAttribute('aria-disabled'), 'false');
    assert.equal(b.getAttribute('aria-label'), '+Keyframe', 'Andy\'s copy, exactly - never "ADD KF"');

    h.select(['a', 'z']);
    assert.equal(b.getAttribute('aria-label'), '+Keyframe on 2 objects', 'and it counts its scope');
  } finally { h.teardown(); }
});

test('a tool that declares no kf sub-field never grows the button', () => {
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    assert.equal(h.root.querySelector<HTMLElement>('.tl-tools .tl-kf-btn')!.hidden, true,
      'the same progressive-capability gate the + and the mic already carry');
  } finally { h.teardown(); }
});

test('+Keyframe at a diamond UPDATES it; off one it adds; both are a single commit', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    const add = kfBtn(h);

    await seek(h, 1500);
    add.click();
    assert.equal(parse(kfOf(h, 'a')).length, 2, 'pressing it on a diamond never duplicates that diamond');
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_eo_x40', 'and re-posing it to the pose it already holds is not an edit');
    assert.equal(h.commits.length, 0, 'so it is not an undo step either');

    await seek(h, 2000);
    add.click();
    assert.equal(h.commits.length, 1);
    const track = parse(kfOf(h, 'a'));
    assert.deepEqual(track.map((k) => k.t), [0, 1500, 2000]);
    assert.deepEqual({ ...track[2]!.v }, { x: 40 },
      'the new diamond holds the pose the box was ALREADY striking there - adding one never moves anything');
    assert.equal(track[2]!.ease, 'eo', 'and it inherits the curve of the segment it landed inside');
  } finally { h.teardown(); }
});

test('+Keyframe on an UNTIMED box promotes it AND keys it in ONE commit', async () => {
  // section 8's M2.5 revision, directive 1: "on an untimed selected object it AUTO-PROMOTES
  // onto the timeline and writes the first keyframe in the same single commit (one undo
  // step - the existing promote() writer + writeKfPose composed)". The count is the
  // assertion: two writers, ONE array, ONE commit, therefore one ⌘Z.
  const h = mount([clip('a', 0, 3), scenery('s')], 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['s']);
    await seek(h, 1000);
    kfBtn(h).click();

    assert.equal(h.commits.length, 1, 'ONE model write for the promotion AND the keyframe');
    const s0 = h.boxes.find((b) => b.id === 's')!;
    // The promotion is `promote()`'s own resolution, composed rather than re-derived:
    // the playhead is the start, and with no authored or media length it is DEFAULT_CLIP_S.
    assert.equal(Number(s0.start), 1, 'placed at the playhead');
    assert.equal(Number(s0.dur), 3, 'with the panel\'s own default length');
    assert.equal(String(s0.lane ?? ''), '', 'on an overlay lane, never the magnetic spine');
    // t = 0 in the box\'s OWN time, because the playhead IS its start now.
    assert.deepEqual(parse(String(s0.kf)).map((k) => k.t), [0]);
    assert.deepEqual({ ...parse(String(s0.kf))[0]!.v }, { x: 0, y: 0, s: 1, r: 0, o: 1 },
      'a full pose at its composition-neutral values - being keyed moves nothing');
    // One commit is one undo step: the array the caller was handed carries both edits,
    // so there is no state in which the box is timed but unkeyed.
    const committed = h.commits[0]!.find((b) => b.id === 's')!;
    assert.equal(Number(committed.start), 1);
    assert.ok(String(committed.kf ?? ''), 'both halves are in the SAME committed array');
  } finally { h.teardown(); }

  // ONE instant, not two reads of the clock. `promoteRows` falls back to `clock.t()` when
  // no start is given, so leaving it out made the promotion read the playhead a second
  // time - later than the `at` the keyframe is then written at. Paused they agree, which
  // is why this is a source assertion and not a behavioural one: the divergence only
  // exists while the transport is PLAYING, and then the clip starts after the time its
  // own first pose is written at (a non-zero local ms, or a clamp to the clip edge) and
  // the announcement names a time no keyframe is at.
  const src = featureSrc('timeline-panel');
  const action = src.slice(src.indexOf('function addKeyframeAction'), src.indexOf('function syncKfBtn'));
  assert.ok(/const at = (?:tp\.\w+\.)?playheadSec\((?:tp)?\)/.test(action), 'the action captures the playhead once');
  assert.ok(/promoteRows\((?:tp, )?next, id, \{ start: at \}\)/.test(action),
    'and the promotion is given THAT instant, never left to re-read the clock');
});

test('audio has no pose to strike, so +Keyframe leaves it out of a mixed selection', async () => {
  const h = mount([
    { ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box,
    { ...overlay('snd', 0, 3), kind: 'audio' } as Box,
  ], 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['snd']);
    assert.equal(kfBtn(h).getAttribute('aria-disabled'), 'true',
      'keyframed gain is plan 101\'s, and until it exists this is not a pose');

    h.select(['a', 'snd']);
    assert.equal(kfBtn(h).getAttribute('aria-disabled'), 'false', 'the other half is keyable');
    await seek(h, 2200);
    kfBtn(h).click();
    assert.equal(h.commits.length, 1, 'one commit for the whole selection');
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 1500, 2200]);
    assert.equal(String(h.boxes.find((b) => b.id === 'snd')!.kf ?? ''), '',
      'and the sound was not given a track it has no evaluator for');
  } finally { h.teardown(); }
});

test('K is the SAME action from the keyboard - including the auto-promotion', async () => {
  // section 8's M2.5 revision: "K stays" and routes through the one action, so a keyboard user
  // gets the whole feature rather than the half of it that existed before the button
  // did. Which means K now opens the door too: the panel being up with something
  // selected IS the disclosure (the revision says so in as many words), and the M2 rule
  // it replaces - "a static box is not animated by a letter" - belonged to a world where
  // the only other door was inside a collapsed group.
  const h = mount([{ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box, clip('b', 3, 2)], 40, ADD_KINDS, KF_CFG);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    h.select(['a']);
    await seek(h, 2200);
    press(h.root, 'k');
    assert.equal(h.commits.length, 1, 'ONE write');
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 1500, 2200]);

    // A static TIMED box: keyed where the playhead is, exactly as the button would.
    h.notify(); await frames(3);
    h.select(['b']);
    await seek(h, 3500);
    press(h.root, 'k');
    assert.equal(h.commits.length, 2);
    assert.deepEqual(parse(kfOf(h, 'b')).map((k) => k.t), [500], 'in the clip\'s own local time');

    // And with nothing selected it is still a no-op that does not fall through to the
    // page: a shortcut that sometimes reaches the browser is one nobody can trust.
    h.notify(); await frames(3);
    h.select([]);
    press(h.root, 'k');
    assert.equal(h.commits.length, 2, 'nothing selected, nothing written');
  } finally { h.teardown(); }
});

test('Alt+←/→ walk the selected clip\'s diamonds and stop at the ends', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40*t2500_x0' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.root.dispatchEvent(new dom.window.Event('pointerenter'));
    h.select(['a']);
    const playhead = h.root.querySelector('.tl-playhead') as HTMLElement;
    await seek(h, 0);

    press(h.root, 'ArrowRight', { altKey: true });
    await frames(3);
    assert.equal(playhead.style.left, '60px', 'to the next diamond (1.5s), not one frame on');
    press(h.root, 'ArrowRight', { altKey: true });
    await frames(3);
    assert.equal(playhead.style.left, '100px');
    press(h.root, 'ArrowRight', { altKey: true });
    await frames(3);
    assert.equal(playhead.style.left, '100px', 'and it stops rather than wrapping round to the start');

    press(h.root, 'ArrowLeft', { altKey: true });
    await frames(3);
    assert.equal(playhead.style.left, '60px');
    assert.equal(h.commits.length, 0, 'walking is not editing');
  } finally { h.teardown(); }
});

test('dragging a diamond retimes it in ONE commit; Alt-dragging copies it instead', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    const dot = dots(h, 'a')[1]!;
    dot.dispatchEvent(pointer('pointerdown', 60));
    h.root.dispatchEvent(pointer('pointermove', 100));
    await frames(3);
    assert.equal(dot.style.left, '100px', 'the dot previews against PANEL DOM only');
    assert.equal(h.commits.length, 0, 'and the model is untouched while the pointer is down');

    h.root.dispatchEvent(pointer('pointerup', 100));
    assert.equal(h.commits.length, 1, 'ONE write on release');
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 2500]);
    assert.equal(parse(kfOf(h, 'a'))[1]!.ease, 'eo', 'the pose and its curve travelled with it');

    h.notify();
    await frames(3);
    h.commits.length = 0;
    const moved = dots(h, 'a')[1]!;
    moved.dispatchEvent(pointer('pointerdown', 100));
    h.root.dispatchEvent(pointer('pointermove', 60, { altKey: true }));
    await frames(3);
    assert.equal(moved.classList.contains('is-duplicating'), true, 'Alt says what the release will do');
    h.root.dispatchEvent(pointer('pointerup', 60, { altKey: true }));
    assert.equal(h.commits.length, 1);
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 1500, 2500],
      'the original stayed put and a copy landed where the drag ended');
  } finally { h.teardown(); }
});

test('the CRUD list is the AT route: real labelled controls that each write once', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    const rows = () => inspAll<HTMLElement>('.tl-kf-row');
    assert.equal(rows().length, 2);
    const first = rows()[0]!;
    // EVERY control in the row is named with the row's own time - not just the two
    // buttons. This list is the keyboard/screen-reader route to the diamonds (which is
    // what lets the diamonds themselves stay aria-hidden), so a four-key track that tabs
    // as "Keyframe curve" four times identifies nothing: `.tl-kf-row` carries no label of
    // its own and the enclosing group is labelled only "Keyframes".
    assert.equal(first.querySelector<HTMLInputElement>('.tl-kf-time')!.getAttribute('aria-label'),
      'Keyframe time in milliseconds at 0:00.0');
    assert.equal(first.querySelector<HTMLSelectElement>('.tl-kf-ease')!.getAttribute('aria-label'),
      'Keyframe curve at 0:00.0');
    assert.equal(first.querySelector<HTMLButtonElement>('.tl-kf-dup')!.getAttribute('aria-label'),
      'Duplicate keyframe at 0:00.0');
    assert.equal(first.querySelector<HTMLButtonElement>('.tl-kf-del')!.getAttribute('aria-label'),
      'Delete keyframe at 0:00.0');
    // …and the point of that: the SECOND row reads differently from the first. Four
    // identical names in a row is the defect, so the assertion is about distinctness.
    const names = (sel: string): string[] =>
      rows().map((r) => r.querySelector(sel)!.getAttribute('aria-label') ?? '');
    for (const sel of ['.tl-kf-time', '.tl-kf-ease', '.tl-kf-dup', '.tl-kf-del']) {
      assert.equal(new Set(names(sel)).size, rows().length, `${sel}: one accessible name per row, never a repeat`);
    }
    assert.ok(names('.tl-kf-ease')[1]!.endsWith('0:01.5'), 'and the name is the row\'s own time');

    // EASE: one token spliced, everything else byte-identical.
    const ease = rows()[0]!.querySelector<HTMLSelectElement>('.tl-kf-ease')!;
    assert.equal(ease.value, 'eio', 'an unwritten ease reads as the grammar\'s default, not as empty');
    ease.value = 'el';
    ease.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 1);
    assert.equal(kfOf(h, 'a'), 't0_el_x0*t1500_eo_x40', 'exactly one token changed');

    // TIME: the numeric ms grid.
    h.notify(); await frames(3);
    const time = rows()[1]!.querySelector<HTMLInputElement>('.tl-kf-time')!;
    assert.equal(time.value, '1500');
    time.value = '900';
    time.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(kfOf(h, 'a'), 't0_el_x0*t900_eo_x40');

    // DUPLICATE, then DELETE - one commit each.
    h.notify(); await frames(3);
    rows()[1]!.querySelector<HTMLButtonElement>('.tl-kf-dup')!.click();
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 900, 1400],
      'a copy lands in the gap after it, never on top of the original');
    h.notify(); await frames(3);
    rows()[1]!.querySelector<HTMLButtonElement>('.tl-kf-del')!.click();
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0, 1400]);
  } finally { closeOverlays(); h.teardown(); }
});

test('the keyframe curve picker names EVERY preset, and a bezier spelling selects its preset', () => {
  // ONE vocabulary (plans/179 M4): the engine names the curve, `EASINGS` gives that name
  // its word, and the picker seeds from the name rather than from string equality on the
  // token - so a curve cannot be called two things, and a preset written as its own
  // bezier selects the preset instead of an extra "Custom" row beside it.
  for (const tok of KF_EASE_TOKENS) {
    const h = mount(kfScene({ ...clip('a', 0, 3), kf: `t0_${tok}_x0*t1500_eo_x40` } as Box), 40, ADD_KINDS, KF_CFG);
    try {
      h.select(['a']);
      setGroup(h.root, 'keyframes', true);
      const sel = inspAll<HTMLSelectElement>('.tl-kf-row .tl-kf-ease')[0]!;
      assert.equal(sel.value, tok, `${tok}: the row selects its own token`);
      const label = Array.from(sel.options).find((o) => o.value === tok)?.textContent;
      assert.equal(label, EASINGS[kfEaseName(tok) as keyof typeof EASINGS],
        `${tok}: named by the shared easing vocabulary, never by the raw token`);
      assert.equal(Array.from(sel.options).filter((o) => o.textContent === 'Custom').length, 0,
        `${tok}: a preset is never also a Custom row`);
    } finally { closeOverlays(); h.teardown(); }
  }

  // `smooth` spelled out as its own control points.
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_eb(0.4)(0)(0.2)(1)_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    const sel = inspAll<HTMLSelectElement>('.tl-kf-row .tl-kf-ease')[0]!;
    assert.equal(sel.value, 'es');
    assert.equal(Array.from(sel.options).find((o) => o.value === 'es')?.textContent, 'Smooth');
  } finally { closeOverlays(); h.teardown(); }
});

test('the Animate door writes a t = 0 pose wherever the playhead is, and Remove takes it all back', async () => {
  const h = mount(kfScene(clip('a', 1, 3)), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    // Deliberately NOT at the clip's start: a door that keyed wherever the playhead
    // happened to be would make the clip jump the moment it was animated.
    await seek(h, 2500);
    (inspEl('.tl-kf-animate') as HTMLButtonElement).click();
    assert.equal(h.commits.length, 1, 'one commit, one undo step');
    const track = parse(kfOf(h, 'a'));
    assert.deepEqual(track.map((k) => k.t), [0]);
    // The seed set: the five channels the canvas and the pose row drive, each at its
    // composition-neutral value, so animating a box does not move it by a pixel.
    assert.deepEqual({ ...track[0]!.v }, { x: 0, y: 0, s: 1, r: 0, o: 1 });

    h.notify(); await frames(3);
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    assert.deepEqual(groupChips(h.root, 'keyframes'), ['1 keyframe']);
    const clear = inspEl('.tl-kf-clear') as HTMLButtonElement;
    assert.equal(clear.querySelector('.tl-action-label')?.textContent, 'Remove 1 keyframe',
      'the destructive action carries its own count');
    clear.click();
    assert.equal(kfOf(h, 'a'), '', 'disabling animation IS removing the track - there is no flag to clear');
    assert.equal(h.commits.length, 2);
  } finally { closeOverlays(); h.teardown(); }
});

test('a diamond right-click offers curve / duplicate / delete, and each is the SAME writer', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    const dot = dots(h, 'a')[1]!;
    const e = new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 60, clientY: 20 });
    dot.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true, 'the diamond claims the press before its bar can');
    const menu = dom.window.document.querySelector('.tl-menu[aria-label="Keyframe actions"]');
    assert.ok(menu, 'a menu of its own, not the clip menu');
    const labels = Array.from(menu!.querySelectorAll('.tl-menu-label')).map((n) => n.textContent);
    assert.deepEqual(labels, ['Keyframe curve', 'Duplicate keyframe', 'Delete keyframe']);

    (menu!.querySelectorAll('.folder-menu-item')[2] as HTMLButtonElement).click();
    assert.equal(h.commits.length, 1, 'one commit');
    assert.deepEqual(parse(kfOf(h, 'a')).map((k) => k.t), [0]);
  } finally { closeOverlays(); h.teardown(); }
});

test('K and Alt+←/→ are in PANEL_SHORTCUTS - the sheet IS the contract, in both directions', () => {
  const rows = PANEL_SHORTCUTS.filter((r) => /Keyframe|keyframe/.test(r.label));
  assert.deepEqual(rows.map((r) => r.keys), ['Alt + ← →', 'K'],
    'both are printed on the sheet a user presses `?` to read');
  assert.deepEqual(
    rows.flatMap((r) => r.events.map((e) => `${e.altKey ? 'Alt+' : ''}${e.key}`)),
    ['Alt+ArrowLeft', 'Alt+ArrowRight', 'k'],
    'and the machine half names every literal key + modifier the handler claims',
  );
  // The two directions of the drift guard are the two tests above this file's
  // ON_KEY_BRANCHES list; this one pins the ROW, so a rename cannot quietly drop a
  // keyframe shortcut off the sheet while leaving the handler in place.
});

test('free-canvas commits the redirection at its ONE pointerup, and never for a resize', () => {
  // The panel cannot assert this from inside itself: the redirection lives at
  // free-canvas's single commit site, which is what makes a keyframed drag one undo
  // step. What IS assertable here is the structure of the contract on both sides - the
  // seam exists and is pure (tested above), and the caller reaches it exactly where
  // the model-write law says it may.
  const src = featureSrc('free-canvas');
  const end = src.slice(src.indexOf('function onGestureEnd'));
  const moveBranch = end.slice(end.indexOf("if (g.type === 'move')"), end.indexOf("if (g.type === 'resize'"));
  const sizeBranch = end.slice(end.indexOf("if (g.type === 'resize'"), end.indexOf("if (g.type === 'gscale'"));
  assert.ok(moveBranch.includes('kfPoseIds('), 'the move commit asks which boxes are parked on a diamond');
  assert.ok(moveBranch.includes('kfPoseWrite('), 'and poses those instead of moving them');
  assert.equal((moveBranch.match(/\bcommit\(/g) ?? []).length, 1,
    'ONE commit in the move branch, however the selection splits between posed and moved');
  assert.ok(/rotKf\s*=\s*g\.type === 'rotate'/.test(sizeBranch),
    'ROTATE is a pose channel, and the branch says so (plans/104 section 5.2)');
  // …and so is RESIZE, since P1 (section 5.2 REVERSED): on a diamond it writes `w`/`h`
  // ABSOLUTELY ('set' - a dragged handle produces the new width, not a change to it),
  // plus the origin shift an nw/n/w handle also makes, as a relative x/y delta.
  assert.ok(/sizeKf\s*=\s*g\.type === 'resize'/.test(sizeBranch),
    'RESIZE is one too, and the branch says which is which');
  assert.ok(/kfPoseWrite\(boxes, \[rotId\], \{ w: live\.w, h: live\.h \}, 'set'\)/.test(sizeBranch),
    "and it writes them with 'set', because w/h are absolute px (section 5.2)");
  assert.equal((sizeBranch.match(/\bcommit\(/g) ?? []).length, 3,
    'the three mutually exclusive endings of one gesture - posed rotate, posed size, base write');
  // Bounded to the BRANCH, not "everything after it": onGestureEnd is not the last
  // redirected commit site in the file (the arrow nudge is, below), and an unbounded
  // slice would read that one as this branch's.
  const gs = end.slice(end.indexOf("if (g.type === 'gscale'"), end.indexOf('function applyLiveRect'));
  assert.equal(gs.includes('kfPoseWrite('), false,
    'group scale ALWAYS writes the base - section 5.2 keeps that rule even now that a single-box resize poses');
});

test('the KEYBOARD move is redirected exactly like the pointer one, and declines the SEEK chord only', () => {
  // The nudge is the accessible equivalent of a drag, so it must get the SAME
  // model-write semantics (plans/104 section 8): on a diamond it poses, off one it moves.
  // And it reserves Alt+←/→ - the panel's keyframe walk (section 9.2: "free-canvas arrow-nudge
  // declines Alt (the seek chord)") - so the chord means one thing in the editor.
  // ONLY that pair, though: Alt+↑/↓ is not a chord anyone binds, and declining it as well
  // made it a key that did nothing anywhere (the panel binds on its own root, so it never
  // hears a canvas-focused press at all).
  const src = featureSrc('free-canvas');
  const nudgeStart = src.indexOf('const nudges: Record<string');
  const nudge = src.slice(nudgeStart, src.indexOf('onStageMove', nudgeStart));
  assert.ok(/altSeek = e\.altKey && \(e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowRight'\)/.test(nudge),
    'the reserved chord is ←/→ with Alt, named as what it is');
  assert.ok(/nudges\[e\.key\] && (?:fc\.)?selection\.size && !altSeek/.test(nudge),
    'the nudge declines exactly that, the way the v/p/n tool letters decline their chords');
  assert.equal(/&& !e\.altKey/.test(nudge), false,
    'and never the bare modifier, which would take ↑/↓ down with it');
  assert.ok(nudge.includes('kfPoseIds(') && nudge.includes('kfPoseWrite('),
    'and asks the same two-call seam the pointer commit asks');
  assert.equal((nudge.match(/\bcommit\(/g) ?? []).length, 1,
    'ONE commit, however the selection splits - one undo step, like the drag');
});

// ── P1: the camera, the depth slider, and section 8's M2.6/M2.7 polish ───────────────
//
// Everything below is the PRODUCT surface of plans/104 P1. The numbers it leans on
// are the engine's (`resolveCamera`, `projectDepth`, `KF_Z_FIELD_CLAMP`) and the
// arithmetic is timeline-math's; what is asserted here is the glue - which control
// writes which field, how many commits a gesture costs, and what the UI says it is
// doing while it does it.

/** The `<button>`s of the Camera group's preset row, by their visible label. */
const presetBtn = (label: string): HTMLButtonElement => {
  const b = inspAll<HTMLButtonElement>('.tl-cam-preset').find((n) => n.textContent?.includes(label));
  assert.ok(b, `the Camera group offers "${label}"`);
  return b!;
};

/** The last thing the panel announced (the polite live region, after its rAF). */
async function spoken(): Promise<string> {
  await frames(2);
  const el = dom.window.document.querySelector('[data-a11y-live]');
  return el?.textContent ?? '';
}

/** The camera box of the last commit, if one was minted. */
const cameraOf = (h: Harness): Box | undefined => h.boxes.find((b) => String(b.kind ?? '') === 'camera');

const CAM_KINDS = [...ADD_KINDS, { id: 'camera', label: 'Camera', seed: { kind: 'camera' } }];

test('the depth slider writes the BASE off a diamond, and mints the scene camera exactly once', async () => {
  // section 5.3 + section 5.4. Depth is the one pose channel with a field of its own, so off a
  // diamond an edit there is section 8's "edits write the base" rather than an invented
  // keyframe - and the FIRST such edit is what auto-creates the untimed scene camera,
  // in the SAME array, so lifting a box is one commit and one undo step.
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 2000);                                  // off every diamond
    const slider = inspEl<HTMLInputElement>('.tl-kf-slider')!;
    assert.equal(slider.disabled, false, 'the slider is live off a diamond - that is the point of it');

    slider.value = '120';
    slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(h.commits.length, 0, 'dragging writes nothing: one model write per gesture');
    assert.equal(inspAll<HTMLInputElement>('.tl-kf-pose-num')[0]!.value, '120',
      'the number beside it mirrors the drag, so the two controls never disagree');

    slider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit on release');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.z, 120, 'the box\'s own depth field, not the track');
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_x40', 'and the keyframes are untouched');

    const cam = cameraOf(h);
    assert.ok(cam, 'the first depth interaction minted the scene camera');
    assert.equal(String(cam!.kind), 'camera');
    assert.equal(cam!.start ?? '', '', 'UNTIMED - an "Always on" scenery chip, not a clip');

    // …and only once. A second lift finds the camera that is already there.
    h.notify();
    await frames(3);
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 2000);
    const again = inspEl<HTMLInputElement>('.tl-kf-slider')!;
    again.value = '200';
    again.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.boxes.filter((b) => String(b.kind ?? '') === 'camera').length, 1,
      'ONE camera, however many boxes are lifted afterwards');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.z, 200);
  } finally { closeOverlays(); h.teardown(); }
});

test('ON a diamond the same slider writes the KEYFRAME, and the field is left alone', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), z: 40, kf: 't0_z40*t1500_z40' } as Box), 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 1500);
    const slider = inspEl<HTMLInputElement>('.tl-kf-slider')!;
    slider.value = '260';
    slider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 1);
    assert.equal(kfOf(h, 'a'), 't0_z40*t1500_z260', 'the keyframe under the playhead');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.z, 40, 'the base depth is what a keyed z REPLACES, not what it edits');
  } finally { closeOverlays(); h.teardown(); }
});

test('the depth slider scrubs the tasteful band and the number takes the whole field clamp', async () => {
  const { KF_Z_FIELD_CLAMP } = await import('../../../../engine/src/keyframes.ts');
  const { KF_Z_SLIDER } = await import('./timeline-panel.ts');
  assert.ok(KF_Z_SLIDER[0] >= KF_Z_FIELD_CLAMP[0] && KF_Z_SLIDER[1] <= KF_Z_FIELD_CLAMP[1],
    'the scrub band lies INSIDE the engine\'s field clamp - the clamp is never re-typed, only narrowed');
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_z0*t1500_z0' } as Box), 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 1500);
    // A hand-driven value past the band still lands inside the FIELD clamp: `min`/`max`
    // are the spinner's range, and the commit is what enforces (section 5.1 names this site).
    const depth = inspAll<HTMLInputElement>('.tl-kf-pose-num')[0]!;
    depth.value = '-5000';
    depth.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(kfOf(h, 'a'), 't0_z0*t1500_z-300', 'clamped to the field range, negative end');
    assert.equal(inspAll<HTMLInputElement>('.tl-kf-pose-num')[0]!.value, '-300');
  } finally { closeOverlays(); h.teardown(); }
});

/** The pose row's tilt control, by channel - never by position (P2.1 moved the indices). */
const poseNum = (ch: string): HTMLInputElement =>
  inspEl<HTMLInputElement>(`.tl-kf-pose-num[data-ch="${ch}"]`)!;

test('the pose row TILTS a box: off a diamond it writes the BASE field, on one it keys (P2.1)', async () => {
  // The `z` rule verbatim on two more channels. A box tilt is a property of the BOX
  // (`canvas.rxField` / `canvas.ryField`) that a keyed `rx`/`ry` REPLACES for its segment,
  // so off every diamond the row writes the field and on one it writes the keyframe and
  // leaves the field alone. It is the BOX's tilt, not the camera's: the two tip the
  // picture in opposite directions and each has its own door.
  const { KF_TILT_CONTROL } = await import('./timeline-panel.ts');
  const [lo, hi] = KF_TILT_CONTROL;
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    assert.deepEqual([poseNum('rx').min, poseNum('rx').max], [String(lo), String(hi)],
      'the control band, never the ±180 wire clamp - the same narrowing the camera rows take');
    assert.equal(inspEl('.tl-kf-pose .tl-kf-slider[data-ch="rx"]'), null,
      'and no slider: depth is still the one channel with a scrub band beside its number');

    await seek(h, 2000);                                  // off every diamond
    assert.equal(poseNum('ry').disabled, false, 'live off a diamond - it has a base field of its own');
    poseNum('ry').value = '30';
    poseNum('ry').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 1, 'ONE commit, therefore one undo step');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.ry, 30, 'the box\'s own tilt field, not the track');
    assert.equal(kfOf(h, 'a'), 't0_x0*t1500_x40', 'and the keyframes are untouched');
    assert.ok(cameraOf(h), 'posing a box in space mints the scene camera, exactly as depth does');

    // `min`/`max` are the spinner's range, not a validator: the COMMIT is what holds a
    // hand-typed angle to the band, so a 500° tilt can never reach the wire.
    poseNum('rx').value = '-500';
    poseNum('rx').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.boxes.find((b) => b.id === 'a')!.rx, lo, 'clamped to the control band, negative end');
    assert.equal(poseNum('rx').value, String(lo), 'and reflected back, so the field cannot disagree');

    // ON a diamond the same control writes the KEYFRAME - and the base tilt it replaces
    // for that segment is left exactly where it was.
    h.notify();
    await frames(3);
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 1500);
    poseNum('rx').value = '20';
    poseNum('rx').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const track = parse(kfOf(h, 'a'));
    assert.equal(track.length, 2, 'no keyframe was added');
    assert.equal(track[1]!.v.rx, 20, 'the diamond under the playhead carries the tilt');
    assert.equal(h.boxes.find((b) => b.id === 'a')!.rx, lo,
      'the base tilt is what a keyed rx REPLACES, not what it edits');
  } finally { closeOverlays(); h.teardown(); }
});

test('a tool that declares no tilt fields gets inert tilt rows, not a control that snaps back', async () => {
  // The progressive gate `zField` already had, now read off `cfg` for all three base
  // channels: with no field to write, an off-diamond edit has nothing to land in, so the
  // row is disabled and says why rather than taking a number and reverting it.
  const noTilt = { cfgPatch: { kfField: 'kf', zField: 'z' } };
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, CAM_KINDS, noTilt);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 2000);
    assert.equal(poseNum('z').disabled, false, 'depth still has its field');
    assert.equal(poseNum('rx').disabled, true, 'no rxField declared, nothing an edit could write');
    poseNum('rx').value = '30';
    poseNum('rx').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, 0, 'and driving it anyway writes nothing');
  } finally { closeOverlays(); h.teardown(); }
});

test('a CAMERA keeps its OWN Tilt rows, and the box tilt pair adds no second door to them', async () => {
  // Two tilts, two doors, and they must not collide: the camera's live in the Camera
  // group (`.tl-cam-num`, ±75, shift-drag), the box's in the pose row - and a camera has
  // no pose row at all, because scale/opacity/blur on a camera would control nothing.
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    setGroup(h.root, 'camera', true);
    setGroup(h.root, 'keyframes', true);
    assert.equal(inspEl('.tl-kf-pose'), null, 'no pose row on a camera, tilt pair or not');
    assert.deepEqual(inspAll<HTMLInputElement>('.tl-cam-num').map((n) => n.dataset.ch),
      ['x', 'y', 'rx', 'ry', 'z', 'f', 'a', 'p'], 'the camera channels are the ones they always were');
    await seek(h, 0);
    const camRx = inspAll<HTMLInputElement>('.tl-cam-num')[2]!;
    camRx.value = '-30';
    camRx.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(kfOf(h, 'cam'), 't0_rx-30', 'and it still writes the CAMERA track, not a box field');
  } finally { closeOverlays(); h.teardown(); }
});

test('the TILT fields take the control band, not the wire clamp - because κ > 0 is an invariant', async () => {
  // ⚑ `buildPlan`'s depth sort is by resolved `z`, and that reproduces a perspective
  // render only while `κ = cos(rx)·cos(ry) > 0`. Past a quarter turn the sign flips: at
  // `rx = −120` three layers at z 0/100/200 have view-axis depths 1200/1250/1300, so the
  // HIGHEST z is farthest, the sort paints it last, and the behind-camera guard never
  // rescues it because `D = P − κζ` GROWS with ζ once κ < 0. P2 first wired the Tilt X /
  // Tilt Y number fields straight to `KF_CLAMPS.rx/ry` = ±180, which is a WIRE clamp
  // (untrusted share links have to be held to something) - so a reachable control sat on
  // the other side of the invariant. `z` is the precedent this follows: KF_Z_SLIDER stops
  // at 300 while its wire spans ±12000.
  const { KF_CLAMPS } = await import('../../../../engine/src/keyframes.ts');
  const { KF_TILT_CONTROL } = await import('./timeline-panel.ts');
  const [lo, hi] = KF_TILT_CONTROL;
  assert.ok(lo >= KF_CLAMPS.rx[0] && hi <= KF_CLAMPS.rx[1],
    'the control band lies INSIDE the wire clamp - the clamp is never re-typed, only narrowed');
  assert.ok(hi < 90 && lo > -90, 'and inside the quarter turn, or κ can reach 0');
  // The invariant itself, at the worst corner of the band: both axes at the extreme.
  const kappa = Math.cos((hi * Math.PI) / 180) * Math.cos((hi * Math.PI) / 180);
  assert.ok(kappa > 0.05, `κ at the band's corner is ${kappa}, too close to the sign change`);

  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    setGroup(h.root, 'camera', true);
    const nums = inspAll<HTMLInputElement>('.tl-cam-num');
    // Pan X, Pan Y, Tilt X, Tilt Y, Dolly, … - the order the labels test pins.
    for (const i of [2, 3]) {
      assert.equal(nums[i]!.min, String(lo), `field ${i} min`);
      assert.equal(nums[i]!.max, String(hi), `field ${i} max`);
    }
    assert.equal(nums[4]!.max, String(KF_CLAMPS.z[1]), 'the dolly still takes its own wire range');
    // …and the COMMIT holds it too: `min`/`max` are the spinner's range, not a guard.
    nums[2]!.value = '-170';
    nums[2]!.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(kfOf(h, 'cam'), `t0_rx${lo}`, 'a hand-typed 170° lands at the band edge');
  } finally { closeOverlays(); h.teardown(); }
});

test('the shift-drag tilt gesture is held to the same band, composed rather than per-delta', async () => {
  // A gesture supplies a DELTA, so clamping the delta would let three drags of +30° walk
  // `rx` past the sign change one commit at a time. `cameraWrite` therefore holds the
  // COMPOSED value: it re-reads the pose the write starts from and shrinks the delta to
  // whatever the band still has room for.
  const { KF_TILT_CONTROL } = await import('./timeline-panel.ts');
  const [, hi] = KF_TILT_CONTROL;
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await seek(h, 0);
    // Three drags of +40°, which un-held would reach 120 - the measured inversion angle.
    // Chained purely, exactly as the existing cameraWrite test does it: the writer reads
    // the pose it composes onto out of the array it is handed.
    let boxes = h.boxes;
    for (let i = 0; i < 3; i++) boxes = h.panel.cameraWrite(boxes, { rx: 40 });
    const keys = parse(String(boxes.find((b) => b.id === 'cam')!.kf));
    assert.equal(keys.length, 1, 'still the scene pose');
    assert.equal(keys[0]!.v.rx, hi, `three +40° drags must stop at the band edge, got ${keys[0]!.v.rx}`);
    // …and a drag the other way still MOVES: the hold is a clamp, not a freeze.
    const back = h.panel.cameraWrite(boxes, { rx: -30 });
    assert.equal(parse(String(back.find((b) => b.id === 'cam')!.kf))[0]!.v.rx, hi - 30);
  } finally { closeOverlays(); h.teardown(); }
});

test('cameraTiltPreview reports the ABSOLUTE tilt a shift-drag would land, clamped (A2/A4)', async () => {
  // The canvas tilt HUD reads this. A camera drag previews nothing on the stage (section 8
  // commits on release), so the number the user sees during the drag IS this call - and
  // it must equal what `cameraWrite` would commit: the current pose plus the delta, held
  // to the band, never a raw unheld delta.
  const { KF_TILT_CONTROL } = await import('./timeline-panel.ts');
  const [lo, hi] = KF_TILT_CONTROL;
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await seek(h, 0);

    // From the rest pose the preview IS the delta.
    assert.deepEqual(h.panel.cameraTiltPreview(h.boxes, -40, 12), { rx: -40, ry: 12 },
      'from rest the preview equals the delta');

    // It COMPOSES onto the pose already held: tilt to −40, a further −20 reads −60.
    const tilted = h.panel.cameraWrite(h.boxes, { rx: -40 });
    assert.equal(h.panel.cameraTiltPreview(tilted, -20, 0)!.rx, -60, 'it adds to the pose already held');

    // …and it is CLAMPED to the band, exactly as the write is - never a raw −200.
    assert.equal(h.panel.cameraTiltPreview(h.boxes, -200, 200)!.rx, lo, 'clamped at the low edge');
    assert.equal(h.panel.cameraTiltPreview(h.boxes, -200, 200)!.ry, hi, 'and at the high edge');

    // Junk deltas are ignored, not propagated as NaN into a readout.
    assert.deepEqual(h.panel.cameraTiltPreview(h.boxes, Number.NaN, Number.NaN), { rx: 0, ry: 0 },
      'a non-finite delta reads as no change');

    // No camera armed → null, and the HUD hides.
    h.select([]);
    assert.equal(h.panel.cameraTiltPreview(h.boxes, 10, 10), null, 'nothing armed, nothing to preview');
  } finally { closeOverlays(); h.teardown(); }
});

test('a camera box swaps Time + Animate for the Camera group, and keeps Keyframes', async () => {
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    assert.deepEqual(
      Array.from(h.root.querySelectorAll<HTMLElement>('.tl-inspector .tl-group')).map((g) => g.dataset.group),
      ['camera', 'keyframes'],
      'the camera panel and its poses - no Time (the switch below is its promotion route), no Animate (v1 ignores a camera\'s transitions)',
    );
    setGroup(h.root, 'camera', true);
    const labels = inspAll<HTMLElement>('.tl-cam-row .field-label').map((n) => n.textContent);
    // P2 added TILT X / TILT Y between the pans and the dolly - the order a shot is set
    // up in (where the camera is, which way it is pointing, how far away it is).
    assert.deepEqual(labels, ['Pan X', 'Pan Y', 'Tilt X', 'Tilt Y', 'Dolly', 'Focus', 'Aperture', 'FOV strength'],
      'the section 4.3 vocabulary: perspective is FOV STRENGTH, and nothing here is called zoom');
    assert.equal(labels.some((l) => /zoom/i.test(l ?? '')), false, 'never "zoom" - eff(z = camZ) = 1 for every p');
    const chips = inspAll<HTMLElement>('.tl-cam-chip');
    assert.deepEqual(chips.map((c) => c.textContent), ['Drag', 'Drag', 'Shift-drag', 'Shift-drag', 'Scroll'],
      'the affordance chips name the canvas gesture that does the same job');
    assert.equal(chips.every((c) => c.getAttribute('aria-hidden') === 'true'), true,
      'decoration: the control beside them is the keyboard route');
  } finally { closeOverlays(); h.teardown(); }
});

test('a camera preset writes the whole track in ONE commit, at the section 4.6 quanta', async () => {
  const { KF_CAMERA_PRESETS } = await import('./timeline-panel.ts');
  const { serialiseKf } = await import('../../../../engine/src/keyframes.ts');
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    setGroup(h.root, 'camera', true);
    click(presetBtn('Push in'));
    assert.equal(h.commits.length, 1, 'ONE commit - one undo step takes the whole move back');
    const wire = String(h.boxes.find((b) => b.id === 'cam')!.kf ?? '');
    const { rescaleKfTrack } = await import('./timeline-math.ts');
    const push = KF_CAMERA_PRESETS.find((p) => p.id === 'push-in')!;
    // The 5 s clip gives the scene a duration, so the 4 s preset is TIME-SCALED to fit it
    // (A1#5) before it is stored - canonicalised by the engine, never the literal author
    // string, and never the un-scaled authored times either.
    assert.equal(wire, serialiseKf(rescaleKfTrack(parse(push.track), 5000)),
      'stored EXPANDED, canonicalised by the ENGINE, and scaled to the 5 s scene');
    assert.equal(parse(wire).length, 2, 'two poses');
    assert.equal(serialiseKf(parse(wire)), wire, 'and it round-trips: parse(serialise(parse(s))) === parse(s)');

    // A PUSH IN gets closer, which under `eff = P/(P − (z − camZ))` means the camera's
    // z goes DOWN. The preset that says "push in" has to push in.
    const keys = parse(wire);
    assert.ok((keys[1]!.v.z ?? 0) < (keys[0]!.v.z ?? 0), 'the dolly moves toward the scene');
  } finally { closeOverlays(); h.teardown(); }
});

test('a camera preset scales its timing to the scene length (A1#5)', async () => {
  // A preset is authored at a fixed length (push-in 4 s, surface-glide 5.2 s). Applied to
  // a scene of another duration it used to keep its absolute times - overrunning a short
  // scene or parking the camera for the tail of a long one. It now stretches to fill THIS
  // scene, so the last keyframe lands on the scene end whatever the authored length was.
  const { KF_CAMERA_PRESETS } = await import('./timeline-panel.ts');
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 8)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    setGroup(h.root, 'camera', true);

    click(presetBtn('Push in'));
    const push = parse(String(h.boxes.find((b) => b.id === 'cam')!.kf ?? ''));
    assert.equal(push.length, 2, 'still two poses - scaling changes tempo, not shape');
    assert.equal(push[0]!.t, 0, 'the move still opens at t0');
    assert.equal(push[push.length - 1]!.t, 8000, 'and RESOLVES at the 8 s scene end, not the authored 4 s');
    assert.ok((push[1]!.v.z ?? 0) < (push[0]!.v.z ?? 0), 'values are untouched - the push still pushes in');

    // Every preset fills the scene, whatever its authored length - surface-glide (5.2 s)
    // and its middle keyframe land on the same 8 s end, mid-point ratio preserved.
    click(presetBtn('Surface glide'));
    const glide = parse(String(h.boxes.find((b) => b.id === 'cam')!.kf ?? ''));
    assert.equal(glide[0]!.t, 0, 'surface-glide also opens at t0');
    assert.equal(glide[glide.length - 1]!.t, 8000, 'and also resolves on the scene end');
    assert.ok(glide.length >= 3 && glide[1]!.t > 0 && glide[1]!.t < 8000, 'its middle keyframe is scaled between');
  } finally { closeOverlays(); h.teardown(); }
});

// This test used to assert the OPPOSITE - that Orbit was offered, `aria-disabled`, and
// carried the reason "Needs tilt (coming)" in both its tooltip and its accessible name.
// P2 IS that tilt (plans/104 section 6.4: `rx`/`ry` now project through a homography), so the
// dimmed twin is gone and Orbit comes out of the same preset loop as every other move.
// The inversion is the point of keeping the test at this name: a reason that has stopped
// being true must not be left standing on a control, and the form of the failure if
// somebody re-disables it is "the button that says it cannot yet, when it can".
test('Orbit is a real move now that tilt has landed - the dimmed twin is gone', async () => {
  const { KF_CAMERA_PRESETS } = await import('./timeline-panel.ts');
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('z', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await frames(3);
    setGroup(h.root, 'camera', true);
    const orbit = presetBtn('Orbit');
    assert.equal(orbit.getAttribute('aria-disabled'), null, 'no longer dimmed');
    assert.equal(orbit.getAttribute('data-tip'), null, 'and no longer explaining itself');
    click(orbit);
    await frames(2);
    assert.equal(h.commits.length, 1, 'one preset, one commit, one undo step');
    const wire = String(h.boxes.find((b) => b.id === 'cam')!.kf ?? '');
    assert.ok(wire.length > 0, 'it writes a real track');
    assert.match(wire, /ry/, 'and the track is an ORBIT - it swings the camera about the aim point');
    // It is in the TABLE, so every other consumer (the announcement, a future menu)
    // resolves it exactly like its siblings.
    assert.equal(KF_CAMERA_PRESETS.some((p) => p.id === 'orbit'), true);
  } finally { closeOverlays(); h.teardown(); }
});

test('the two TILT presets end at the rest pose - THE RESOLUTION RULE, enforced', async () => {
  // Andy, 2026-08-12, binding on every generated animation: "elements lift off and rest
  // back down on the page; the animations showing them falling apart need to close out
  // with it all coming together." So the last keyframe of anything WE generate is the
  // authored composition - every channel the track touches back at its default. A
  // deconstruction is a middle, never an ending.
  //
  // Scoped to the tilt pair because they are what P2 ships. The five P1 presets predate
  // the rule and three of them do NOT obey it (push-in ends at z −220, pan-across at
  // x 140, rise at y −120/z −80) - measured and reported at KF_CAMERA_PRESETS rather
  // than changed in passing, because bringing them home would change what three shipped
  // moves MEAN.
  const { KF_CAMERA_PRESETS } = await import('./timeline-panel.ts');
  const { parseKf, evaluateKf, kfChannelsUsed } = await import('../../../../engine/src/keyframes.ts');
  // The camera's own neutral pose. `p` is absent on purpose: a track that keyframes the
  // perspective strength has to come home to the DEFAULT (1200), not to zero, and
  // neither shipped tilt move touches it.
  const REST: Record<string, number> = { x: 0, y: 0, z: 0, rx: 0, ry: 0, f: 0, a: 0, s: 1, o: 1, b: 0 };
  const tilted = KF_CAMERA_PRESETS.filter((p) => /_r[xy]-?\d/.test(p.track));
  assert.equal(tilted.length, 2, 'P2 ships exactly two tilt moves: Surface glide and Orbit');
  for (const preset of tilted) {
    const track = parseKf(preset.track);
    const end = track[track.length - 1]!.t;
    const pose = evaluateKf(track, end);
    for (const ch of kfChannelsUsed(track)) {
      assert.equal(pose[ch], REST[ch] ?? 0,
        `${preset.id}: channel ${ch} ends at ${pose[ch]}, not at rest (${REST[ch] ?? 0}) - `
        + 'the glide is a departure that comes home');
    }
    // …and it actually WENT somewhere first, or "ends at rest" is vacuous.
    const mid = evaluateKf(track, end / 2);
    assert.ok(
      kfChannelsUsed(track).some((ch) => Math.abs((mid[ch] ?? 0) - (REST[ch] ?? 0)) > 1),
      `${preset.id}: the move never leaves the rest pose, so ending there proves nothing`,
    );
  }
});

test('a preset applied with NO camera mints the scene camera and keys it in the same commit', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), z: 80 } as Box), 40, CAM_KINDS, KF_CFG);
  try {
    // No camera anywhere: the box's own depth interaction is what would normally mint
    // one, but a preset must be able to be the first thing a user ever presses.
    h.select(['a']);
    await frames(3);
    assert.equal(cameraOf(h), undefined, 'precondition: no camera');
    // Reach the writer the way the Camera group does - the group only exists on a
    // camera, so this is the "camera mode entered" door of section 5.4's three.
    const { KF_CAMERA_PRESETS } = await import('./timeline-panel.ts');
    const cam = { id: 'cam', kind: 'camera', start: '', dur: '' } as Box;
    const h2 = mount([...h.boxes, cam], 40, CAM_KINDS, KF_CFG);
    try {
      h2.select(['cam']);
      await frames(3);
      setGroup(h2.root, 'camera', true);
      click(presetBtn('Reveal'));
      assert.equal(h2.commits.length, 1);
      const reveal = KF_CAMERA_PRESETS.find((p) => p.id === 'reveal')!;
      assert.equal(parse(String(h2.boxes.find((b) => b.id === 'cam')!.kf)).length, parse(reveal.track).length);
    } finally { closeOverlays(); h2.teardown(); }
  } finally { closeOverlays(); h.teardown(); }
});

test('camera mode is entered by SELECTION, and only while the camera is running', async () => {
  const h = mount([
    { id: 'cam', kind: 'camera', start: 1, dur: 2 } as Box,
    clip('a', 0, 5),
  ], 40, CAM_KINDS, KF_CFG);
  try {
    assert.equal(h.panel.cameraModeId(), '', 'nothing selected: no camera mode');
    h.select(['a']);
    await frames(3);
    assert.equal(h.panel.cameraModeId(), '', 'a content box is not a camera');
    h.select(['cam']);
    await seek(h, 1500);
    assert.equal(h.panel.cameraModeId(), 'cam', 'selected, and the playhead is inside its window');
    await seek(h, 3500);
    assert.equal(h.panel.cameraModeId(), '', 'outside the window: not the camera you are looking through');
    await seek(h, 1500);
    h.select(['cam', 'a']);
    await frames(3);
    assert.equal(h.panel.cameraModeId(), '', 'a mixed selection aims at nothing in particular');
    h.select(['cam']);
    await frames(3);
    h.panel.setOpen(false);
    assert.equal(h.panel.cameraModeId(), '', 'a CLOSED panel arms nothing - the same rule kfPoseIds obeys');
  } finally { closeOverlays(); h.teardown(); }
});

test('cameraWrite folds a gesture into the SCENE DEFAULT, and refuses a moving camera off a diamond', async () => {
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('a', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    h.select(['cam']);
    await seek(h, 2000);
    // NO track at all: the scene default lives at t = 0 and a pan writes it there, so
    // the fresh implicit camera behaves as SCENE DEFAULTS with no keyframe UI in the way.
    const next = h.panel.cameraWrite(h.boxes, { x: -40 });
    const keys = parse(String(next.find((b) => b.id === 'cam')!.kf));
    assert.equal(keys.length, 1, 'one key - the scene pose');
    assert.equal(keys[0]!.t, 0, 'at t = 0, not under the playhead: no diamond was invented');
    assert.equal(keys[0]!.v.x, -40);

    // A single key is STILL the scene default (evaluation clamp-holds either side).
    const two = h.panel.cameraWrite(next, { x: -10 });
    const k2 = parse(String(two.find((b) => b.id === 'cam')!.kf));
    assert.equal(k2.length, 1, 'still one key');
    assert.equal(k2[0]!.v.x, -50, 'and the delta composed onto what it already held');

    // A real MOVE, with the playhead off every diamond, has nowhere honest to land.
    const moving = h.boxes.map((b) => (b.id === 'cam' ? { ...b, kf: 't0_x0*t1000_x100' } : b));
    assert.equal(h.panel.cameraWrite(moving, { x: 25 }), moving, 'refused - by identity, so the caller commits nothing');
  } finally { closeOverlays(); h.teardown(); }
});

test('the camera gesture map: the canvas hands the WHEEL to the view unless a camera is armed', () => {
  // section 8: "plain wheel = dolly (camZ, preventDefault; Cmd/Ctrl-wheel stays VIEW zoom,
  // Space+drag stays VIEW pan)". The separation is the whole reason camera mode can be
  // a selection rather than a mode, so it is pinned at the source: free-canvas is the
  // only listener that could claim the notch, and it must decline three ways.
  const src = featureSrc('free-canvas');
  const wheelStart = src.indexOf('function onCameraWheel');
  const wheel = src.slice(wheelStart, src.indexOf('ctxValueHeld', wheelStart));
  assert.ok(/if \(e\.ctrlKey \|\| e\.metaKey\) return;/.test(wheel), 'Cmd/Ctrl-wheel is the VIEW zoom, untouched');
  assert.ok(/if \(!camModeId\((?:fc)?\)\) return;/.test(wheel), 'no camera armed: the view keeps its pan');
  assert.ok(wheel.includes('e.preventDefault()') && wheel.includes('e.stopPropagation()'),
    'and when it IS claimed, the stage never sees it');
  assert.ok(/setTimeout\((?:fc\.\w+\.)?flushDolly/.test(wheel), 'the notches coalesce to one commit per pause');
  // Space+drag is stageNav's and free-canvas already yields to it by tracking `spacePan`;
  // the camera must not have taken that back.
  assert.ok(/if \(e\.pointerType !== 'mouse' \|\| (?:fc\.)?spacePan\) return;/.test(src),
    'Space+drag stays the view pan');
  // The pan takes the gesture the MARQUEE would have had, on both empty surfaces.
  assert.equal((src.match(/camModeId\((?:fc)?\)\) \{\n\s+(?:fc\.\w+\.)?beginGesture\((?:fc, )?e, \{/g) ?? []).length, 2,
    'the artboard and the backdrop - a camera pan with an invisible boundary is not one');
  // P2 SPENDS THE RESERVED CHORD. Shift-drag was held back at M2.5 ("shift-drag
  // reserved for tilt (P2)") precisely so it could be given one meaning once rather
  // than two in a row; both entry points now branch on it, and the additive marquee
  // keeps Shift everywhere a camera is not armed.
  assert.equal((src.match(/\{ type: 'camtilt',/g) ?? []).length, 0,
    'the two entry points choose between the two gestures rather than open-coding either');
  assert.equal((src.match(/type: e\.shiftKey \? 'camtilt' : 'campan',/g) ?? []).length, 2,
    'both entry points read Shift');
  const end = src.slice(src.indexOf('function onGestureEnd'));
  const camBranch = end.slice(end.indexOf("if (g.type === 'campan')"), end.indexOf("if (g.type === 'camtilt')"));
  assert.ok(camBranch.includes('cameraWrite('), 'and it commits through the panel\'s own writer');
  assert.equal((camBranch.match(/\bcommit\(/g) ?? []).length, 1, 'ONE commit, on release');
  // The TILT release obeys the same law - one gesture, one write, one undo step - and
  // reaches the model through the same writer rather than a second path of its own.
  const tiltBranch = end.slice(end.indexOf("if (g.type === 'camtilt')"), end.indexOf("if (g.type === 'marquee')"));
  assert.ok(tiltBranch.includes('cameraWrite('), 'the tilt commits through the panel\'s writer too');
  assert.equal((tiltBranch.match(/\bcommit\(/g) ?? []).length, 1, 'ONE commit, on release');
  assert.ok(/rx: -dy \* CAM_TILT_DEG_PER_PX/.test(tiltBranch),
    'drag DOWN pitches the camera nose-down over the artwork (rx negative), which is direct manipulation');
  assert.ok(/ry: dx \* CAM_TILT_DEG_PER_PX/.test(tiltBranch), 'drag RIGHT brings the right-hand edge nearer');
  // …and the drag is accumulated in NATIVE px. `camX` is a MODEL number and the picture
  // it displaces is on screen at the canvas zoom, so direct manipulation - the property
  // the branch above says it is delivering - needs the client delta divided by that
  // zoom. Client px written straight into the model moved the shot half as far as the
  // hand at 50 % and twice as far at 200 %.
  const move = src.slice(src.indexOf('function applyGestureMove'));
  const panBranch = move.slice(move.search(/if \((?:fc\.)?gesture\.type === 'campan'\)/), move.search(/if \((?:fc\.)?gesture\.type === 'camtilt'\)/));
  assert.ok(panBranch.includes('clientToNative('), 'the pan converts through the canvas zoom, like every other drag');
  assert.ok(!/gesture\.dx \+= e\.clientX/.test(panBranch), 'never client px straight into the model');
  // …and the TILT is the deliberate opposite: an angle has no length in stage space, so
  // converting would gear the dial by however far the user happens to be zoomed out.
  const tiltMove = move.slice(move.search(/if \((?:fc\.)?gesture\.type === 'camtilt'\)/), move.search(/if \((?:fc\.)?gesture\.type === 'pendraw'\)/));
  assert.ok(/gesture\.dx \+= e\.clientX/.test(tiltMove), 'the tilt accumulates CLIENT px');
  assert.ok(!tiltMove.includes('clientToNative('), 'and never converts them');
});

test('clicking a diamond opens the Keyframes popup ON that keyframe', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    await seek(h, 0);
    assert.equal(groupPopEl(), null, 'precondition: nothing is open');
    const dot = dots(h, 'a')[1]!;
    dot.dispatchEvent(pointer('pointerdown', 60));
    dot.dispatchEvent(pointer('pointerup', 60));
    await frames(3);
    const pop = groupPopEl();
    assert.ok(pop, 'the Keyframes popup opened on the press (section 8 M2.7 (a))');
    assert.equal(pop!.getAttribute('aria-label'), 'Keyframes', 'and it is that group, not another');
    assert.equal((inspEl('.tl-kf-state') as HTMLElement).textContent, 'Keyframe @ 0:01.5',
      'ON the keyframe that was pressed: the playhead went with the selection');
    assert.equal(h.commits.length, 0, 'looking at a keyframe is not editing one');
  } finally { closeOverlays(); h.teardown(); }
});

test('the curve editor is DOCKED in the Keyframes popup, and a drag switches the select to Custom', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_eo_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    setGroup(h.root, 'keyframes', true);
    await seek(h, 2000);
    assert.equal(inspEl('.tl-kf-dock .ease-ed'), null, 'off a diamond there is no curve to shape…');
    assert.match((inspEl('.tl-kf-dock-note') as HTMLElement).textContent ?? '', /Move the playhead/,
      '…and the dock says so in the same words the pose fields use');

    await seek(h, 1500);
    const plot = inspEl<HTMLElement>('.tl-kf-dock .ease-ed-plot');
    assert.ok(plot, 'ON a diamond the plot is docked INSIDE the popup - never a second popover');
    // …and ONLY while the popup shows it: the editor runs a rAF loop for its motion
    // strip, and a group's body stays in the document when the group is shut.
    setGroup(h.root, 'keyframes', false);
    await frames(3);
    assert.equal(dom.window.document.querySelector('.tl-kf-dock .ease-ed'), null,
      'shutting the popup takes the editor down rather than leaving it painting unseen');
    setGroup(h.root, 'keyframes', true);
    await frames(3);
    assert.ok(inspEl('.tl-kf-dock .ease-ed-plot'), 'and re-opening builds it again');
    assert.equal(dom.window.document.querySelectorAll('.tl-ease-pop').length, 0,
      'and nothing nested opened alongside it');
    // The row's own select carries no "Custom…" route any more: the dock IS the editor.
    const sel = inspAll<HTMLSelectElement>('.tl-kf-row .tl-kf-ease')[1]!;
    assert.equal(Array.from(sel.options).some((o) => o.value === '__custom'), false,
      'one surface: the route died with the nested popover it opened');
    assert.equal(sel.value, 'eo', 'the docked plot and the select are showing the same curve');

    // Drag a handle: one commit, and the select is now on a Custom option it did not
    // have before - "they can use presets to learn" (section 8's M2.7 (b)). Re-queried, because
    // the close/open above minted a new editor.
    const live = inspEl<HTMLElement>('.tl-kf-dock .ease-ed-plot')!;
    const handle = inspEl<Element>('.tl-kf-dock .ease-ed-handle')!;
    handle.dispatchEvent(pointer('pointerdown', 30));
    live.dispatchEvent(pointer('pointermove', 44, { clientY: 10 }));
    live.dispatchEvent(pointer('pointerup', 44, { clientY: 10 }));
    await frames(3);
    assert.equal(h.commits.length, 1, 'ONE commit for the drag');
    const after = parse(kfOf(h, 'a'))[1]!;
    assert.match(after.ease, /^eb\(/, 'a bezier token, written through the engine\'s own adapter');
    // The repaint a real commit causes (free-canvas notifies the runtime), so the row
    // this reads is the one the write rebuilt.
    h.notify();
    await frames(3);
    const sel2 = inspAll<HTMLSelectElement>('.tl-kf-row .tl-kf-ease')[1]!;
    assert.equal(sel2.value, after.ease, 'the select followed it');
    assert.equal(sel2.selectedOptions[0]!.textContent, 'Custom', 'and says what it is');
  } finally { closeOverlays(); h.teardown(); }
});

test('M2.6 lows: no focusable node in the aria-hidden strip, and the enlarged mark survives a rebuild', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_eo_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    await seek(h, 1500);
    const strip = h.bar('a').querySelector('.tl-kf-strip') as HTMLElement;
    assert.equal(strip.getAttribute('aria-hidden'), 'true');
    assert.equal(strip.querySelectorAll('[tabindex], a[href], button, input, select, textarea').length, 0,
      'nothing inside an aria-hidden subtree may be focusable - not even tabindex="-1"');
    assert.deepEqual(dots(h, 'a').map((n) => n.classList.contains('is-selected')), [false, true],
      'precondition: the playhead\'s diamond draws large');

    // A ROW REBUILD mints new dots. The latch answer has not changed, so its memo would
    // skip the re-mark and the enlarged diamond would silently vanish (section 8's M2.6 low).
    h.notify();
    await frames(3);
    assert.deepEqual(dots(h, 'a').map((n) => n.classList.contains('is-selected')), [false, true],
      'the mark is re-applied to the dots that replaced the marked ones');
  } finally { closeOverlays(); h.teardown(); }
});

test('M2.6 low: Alt+←/→ says what it actually found - nothing selected, nothing animated, or the end', async () => {
  const h = mount(kfScene({ ...clip('a', 0, 3) } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    const alt = (key: string): void => {
      h.root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }));
    };
    h.select([]);
    await frames(3);
    alt('ArrowRight');
    assert.equal(await spoken(), 'Select something on the canvas to keyframe it',
      'nothing selected is not "last keyframe"');

    h.select(['a']);
    await frames(3);
    alt('ArrowRight');
    assert.equal(await spoken(), 'No keyframes',
      'a box with an empty track has no last keyframe to be at');

    // …and with a track, the honest end-of-track message comes back.
    const h2 = mount(kfScene({ ...clip('a', 0, 3), kf: 't0_x0*t1500_x40' } as Box), 40, ADD_KINDS, KF_CFG);
    try {
      h2.select(['a']);
      await seek(h2, 1500);
      h2.root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true }));
      assert.equal(await spoken(), 'Last keyframe');
    } finally { closeOverlays(); h2.teardown(); }
  } finally { closeOverlays(); h.teardown(); }
});

test('M2.6 low: the Animate chip is never capped, so its second kind cannot be ellipsed away', () => {
  const css = readFileSync(new URL('../styles/parts/timeline.css', import.meta.url), 'utf8');
  const rule = css.slice(css.indexOf('.tl-group[data-group="animate"]'));
  assert.ok(/\.tl-group\[data-group="animate"\][^{]*\.tl-group-chip \{ max-width: none; \}/.test(rule.slice(0, 400)),
    'the pair chip is uncapped - the strip it sits in scrolls, so a longer segment is not a lost one');
  assert.ok(/\.tl-group\[data-group="animate"\] > \.tl-group-head/.test(rule.slice(0, 400)),
    'and the head\'s own cap goes with it, or the chip is capped by its container instead');
});

test('an untimed camera reads as "Camera" on its Always-on chip, never as "Clip"', async () => {
  // The chip IS the affordance the implicit scene camera is discovered through (section 5.4),
  // and every media probe reads '' on a box that paints nothing - so without a model
  // branch it wore the fallback label of the one thing it is not.
  const h = mount([{ id: 'cam', kind: 'camera', start: '', dur: '' } as Box, clip('a', 0, 5)], 40, CAM_KINDS, KF_CFG);
  try {
    const chip = h.root.querySelector('.tl-scenery [data-id="cam"]') as HTMLElement;
    assert.ok(chip, 'an untimed camera is a scenery chip, not a bar');
    assert.match(chip.textContent ?? '', /Camera/);
  } finally { closeOverlays(); h.teardown(); }
});

test('the camera add-kind is offered by the panel\'s + menu, with its own glyph', async () => {
  const h = mount([clip('a', 0, 3)], 40, CAM_KINDS, KF_CFG);
  try {
    click(h.root.querySelector('.tl-add') as HTMLElement);
    await frames(2);
    const labels = Array.from(openMenu('.tl-menu')!.querySelectorAll('.tl-menu-label')).map((n) => n.textContent);
    assert.ok(labels.includes('Camera'), 'the manifest\'s own label, read from addKinds');
  } finally { closeOverlays(); h.teardown(); }
});

test('kfPoseWrite in \'set\' mode writes the size ABSOLUTELY - the resize seam\'s half of section 5.2', async () => {
  // free-canvas hands the handle's resulting WIDTH, not a change to it, so the seam has
  // to take a value rather than a delta. The mode is the caller's to choose because only
  // the caller knows which reading its gesture produced: a drag is relative, a resize is
  // not. (The commit site itself is pinned by the source test above - the panel cannot
  // observe free-canvas's pointerup from in here.)
  const h = mount(kfScene({ ...clip('a', 0, 3), w: 400, h: 300, kf: 't0_x0*t1500_x40' } as Box), 40, ADD_KINDS, KF_CFG);
  try {
    h.select(['a']);
    await seek(h, 1500);
    const next = h.panel.kfPoseWrite(h.boxes, ['a'], { w: 640, h: 360 }, 'set');
    const keys = parse(String(next.find((b) => b.id === 'a')!.kf));
    assert.deepEqual({ ...keys[1]!.v }, { x: 40, w: 640, h: 360 },
      'the size lands as the value it IS, beside the channel the track already animates');
    assert.deepEqual({ ...keys[0]!.v }, { x: 0 }, 'and the other keyframe stays sparse');
    // The same numbers under 'add' would be nonsense - 640px ADDED to a 400px box - which
    // is exactly why the mode is a parameter and not a constant.
    const wrong = h.panel.kfPoseWrite(h.boxes, ['a'], { w: 640, h: 360 });
    assert.equal(parse(String(wrong.find((b) => b.id === 'a')!.kf))[1]!.v.w, 640,
      'add over an unauthored size is the size itself (neutral 0), which is why the default is safe but not right');
    assert.equal(h.commits.length, 0, 'the seam never commits - the caller owns the write');
  } finally { closeOverlays(); h.teardown(); }
});

// ── Export frame (WP-D) ────────────────────────────────────────────────────

test('Export frame decodes the clip\'s ORIGINAL asset at its own local media time', async () => {
  const calls: Array<{ url: string; tSec: number }> = [];
  _setFrameAtImpl(async (url, tSec) => { calls.push({ url, tSec }); return null; });
  const h = mount([{ id: 'v', start: 1, dur: 4, lane: 'seq', clipIn: 2, speed: 2 } as Box]);
  try {
    paintVideo(h, 'v', 20);
    const video = h.canvasEl.querySelector('video') as HTMLVideoElement;
    // Deterministic identity for the "original" URL, independent of jsdom's own
    // (unspecified, here) src-attribute resolution.
    Object.defineProperty(video, 'src', { value: 'blob:clip-original-abc', configurable: true });
    h.panel.setOpen(false); h.panel.setOpen(true);

    // Playhead at 2s, on a box that starts at 1s, trimmed in 2s of media and playing
    // at 2×: one second of timeline has elapsed since the box's own start, which is
    // two seconds of MEDIA at 2× - so the frame under the playhead sits at
    // clipIn(2) + (2 - 1) × 2 = 4s into the source file.
    await seek(h, 2000);

    rightClick(h.bar('v'));
    const item = Array.from(openMenu('.tl-ctx-menu')!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim().startsWith('Export frame'))!;
    assert.ok(item, '"Export frame" is offered for a video clip');
    click(item);
    await frames(3);

    assert.equal(calls.length, 1, 'the decode was attempted exactly once');
    assert.equal(calls[0]!.url, 'blob:clip-original-abc', 'the ORIGINAL asset url');
    assert.equal(calls[0]!.tSec, 4, 'clipIn + elapsed×speed - the box\'s own local-media-time mapping');
  } finally {
    _setFrameAtImpl(null);
    h.teardown();
  }
});

test('Export frame is offered only for a video clip - absent, never greyed, on anything else', () => {
  const h = mount([clip('card', 0, 3)]);
  try {
    assert.equal(ctxLabels(h, 'card').includes('Export frame'), false);
  } finally { h.teardown(); }
});

// ── the Pan row (plans/165 WP-5) ──────────────────────────────────────────────
//
// Same contract as the Volume row it sits under: shown only where the manifest
// declares the sub-field AND the box carries sound, one model write per commit,
// and the centred value clears the field so an untouched box stays byte-identical.

/** Give a box a live-canvas audio footprint, the thing mediaOf() classifies on. */
function fakeCanvasAudio(h: Harness, id: string): void {
  const el = h.canvasEl.ownerDocument!.createElement('div');
  el.className = 'lolly-box';
  el.setAttribute('data-box-id', id);
  const au = h.canvasEl.ownerDocument!.createElement('div');
  au.className = 'lolly-box-audio';
  au.setAttribute('data-audio-src', 'blob:song');
  au.setAttribute('data-audio-dur', '4000');
  el.appendChild(au);
  h.canvasEl.appendChild(el);
}

test('the Pan row: audio boxes get it, it writes once, and centred clears the field', () => {
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain', panField: 'pan' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    const pan = field(h.root, 'Pan');
    assert.equal(pan.value, '0', 'an unauthored box reads centred');
    const before = h.commits.length;
    type(pan, '-50');
    assert.equal(h.commits.length, before + 1, 'one commit per edit');
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).pan, -0.5, 'percent maps to the -1..1 field');
    type(pan, '0');
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).pan, '', 'centred clears, not a stored 0');
  } finally { h.teardown(); }
});

test('the ducking select: audio boxes get it, choices write the level, no-duck clears', () => {
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain', duckField: 'duck' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    const sel = field(h.root, 'Under other audio');
    assert.equal(sel.value, '', 'an unauthored box reads no-change');
    sel.value = '0.2';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).duck, 0.2, 'Quieter writes the duck-to level');
    sel.value = '';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).duck, '', 'No change clears, not a stored 1');
  } finally { h.teardown(); }
});

test('the Pitch row transposes in semitones, 0 clears; no Preserve-pitch toggle at speed 1', () => {
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain', pitchField: 'pitch', varispeedField: 'varispeed' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    const pitch = field(h.root, 'Pitch');
    assert.equal(pitch.value, '0', 'an unauthored box reads as recorded');
    type(pitch, '7');
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).pitch, 7, 'semitones written raw');
    type(pitch, '0');
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).pitch, '', '0 clears, not a stored 0');
    const labels = Array.from(h.root.ownerDocument!.querySelectorAll('.tl-inspector .field-label')).map((x) => x.textContent);
    assert.equal(labels.includes('Preserve pitch'), false, 'the toggle is meaningless at speed 1');
  } finally { h.teardown(); }
});

test('Preserve pitch on a sped clip: unticking writes varispeed, re-ticking clears it', () => {
  const h = mount([{ ...clip('a', 0, 3), speed: 2 }], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain', varispeedField: 'varispeed' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    const rows = Array.from(h.root.ownerDocument!.querySelectorAll<HTMLElement>('.tl-inspector .tl-field'));
    const row = rows.find((x) => x.querySelector('.tl-alab')?.getAttribute('aria-label') === 'Preserve pitch');
    assert.ok(row, 'the toggle shows on a sped clip');
    const check = row!.querySelector('.field-check') as HTMLInputElement;
    assert.equal(check.checked, true, 'preserve pitch is the default');
    check.checked = false;
    check.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).varispeed, 'true', 'tape-style is the authored exception');
    check.checked = true;
    check.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).varispeed, '', 'the default clears the field');
  } finally { h.teardown(); }
});

test('the Effect rack: presets write the EXPANDED chain, a foreign chain reads Custom and survives', () => {
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain', fxField: 'fx' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    const sel = field(h.root, 'Effect');
    assert.equal(sel.value, '', 'an unauthored box reads No effect');
    sel.value = 'room';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).fx, 'rv(20-35)',
      'the preset stores its expanded chain, never its name');
    sel.value = '';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal((h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).fx, '', 'No effect clears');
    // A hand-authored chain: reads back as Custom, and reselecting Custom writes nothing.
    h.select([]);
    (h.boxes.find((b) => b.id === 'a') as Record<string, unknown>).fx = 'hp(120).crush(6)';
    h.select(['a']);
    const sel2 = field(h.root, 'Effect');
    assert.equal(sel2.value, '__custom', 'a foreign chain shows as Custom');
    const before = h.commits.length;
    sel2.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.commits.length, before, 'reselecting Custom commits nothing');
  } finally { h.teardown(); }
});

test('the Pan row stays out of a tool that never declared panField', () => {
  const h = mount([clip('a', 0, 3)], 40, ADD_KINDS, { cfgPatch: { gainField: 'gain' } });
  try {
    fakeCanvasAudio(h, 'a');
    h.select(['a']);
    assert.ok(field(h.root, 'Volume'), 'precondition: the audio rows are otherwise live');
    assert.equal(h.root.ownerDocument!.querySelector('.tl-inspector .tl-alab[aria-label="Pan"]'), null,
      'no manifest sub-field, no row');
  } finally { h.teardown(); }
});

// ── plans/179 T2: closing the timeline releases the clock ─────────────────────

/** The applier's own class + the export-time authored scope, imported so the
 *  assertions below cannot drift from the module they are about. */
const { OFF_CLASS, beginAuthoredDom } = await import('../bridge/sequence-dom.ts');

/**
 * The canvas a tool hook renders for a timed composition: a stage that declares its
 * length, and one element per box carrying the `data-t-*` the applier reads. This is
 * the ONLY input the sequence clock has - it never sees the model.
 */
function paintSequence(h: Harness, seqMs: number, boxes: Record<string, Record<string, string>>): void {
  h.canvasEl.setAttribute('data-seq-ms', String(seqMs));
  for (const [id, attrs] of Object.entries(boxes)) {
    const el = h.canvasEl.ownerDocument!.createElement('div');
    // A frames doc's scenes are PAGES, not boxes - `sequenceTimeElements` walks
    // `[data-t-start]` rather than `.lolly-box` for exactly that reason, and the deck
    // repro ("Place in order", then Escape) leaves its artboards behind, not its boxes.
    const page = attrs['data-pdf-page'] != null;
    el.className = page ? 'lolly-frame-page' : 'lolly-box';
    el.setAttribute(page ? 'data-frame-id' : 'data-box-id', id);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    h.canvasEl.appendChild(el);
  }
}

const painted = (h: Harness, id: string): HTMLElement =>
  h.canvasEl.querySelector(`[data-box-id="${id}"], [data-frame-id="${id}"]`) as HTMLElement;

/** The panel handle's time seam, which the Harness type does not restate. */
const clockOf = (h: Harness): { seek(sec: number): void; time(): number } =>
  h.panel as unknown as { seek(sec: number): void; time(): number };   // both in SECONDS

test('closing the timeline RELEASES the clock: no seq-off, no composed pose, and the playhead is kept', () => {
  // Two scenes and a fade. Parked at 4s, scene one is off screen entirely and scene
  // two is exactly half way into a 2s fade-in - so there is BOTH a hidden box and a
  // posed one to hand back, which is the pair the bug left behind.
  const h = mount([clip('one', 0, 3), clip('two', 3, 3)]);
  try {
    paintSequence(h, 6000, {
      // Artboards, as "Place in order" leaves them: sequenced [data-pdf-page] frames.
      one: { 'data-pdf-page': '', 'data-t-start': '0', 'data-t-dur': '3000' },
      two: { 'data-pdf-page': '', 'data-t-start': '3000', 'data-t-dur': '3000', 'data-t-enter': 'fade', 'data-t-enter-ms': '2000' },
    });
    clockOf(h).seek(4);
    assert.ok(painted(h, 'one').classList.contains(OFF_CLASS), 'precondition: the off-playhead scene is hidden');
    assert.ok(painted(h, 'two').style.opacity !== '', 'precondition: the on-playhead scene is mid-fade');

    h.panel.setOpen(false);

    // The whole of T2: a canvas with no clock on it shows every box, at rest.
    assert.equal(h.canvasEl.querySelectorAll(`.${OFF_CLASS}`).length, 0,
      'closing the panel left a box hidden with nothing on screen to explain it');
    assert.equal(painted(h, 'two').style.opacity, '',
      'the composed pose went back to the authored one');

    // …and it is a HOLD, not a teardown: the playhead survives the close.
    assert.ok(Math.abs(clockOf(h).time() - 4) < 0.001, 'the clock kept its time');
    h.panel.setOpen(true);
    assert.ok(painted(h, 'one').classList.contains(OFF_CLASS), 'reopening resumes at the same playhead');
    assert.ok(painted(h, 'two').style.opacity !== '', '…including the pose it had');
  } finally { h.teardown(); }
});

test('a released canvas stays released: an export-shaped authored scope cannot re-hide it', () => {
  // The door the release had to close. `withAuthoredDom` stands every live writer down
  // and re-asserts it afterwards - so with the clock merely PAUSED, the first export
  // taken after closing the timeline put `.seq-off` straight back on a canvas the user
  // was editing. The hold nests inside the scope, so the resume finds it still held.
  const h = mount([clip('one', 0, 3), clip('two', 3, 3)]);
  try {
    paintSequence(h, 6000, {
      one: { 'data-t-start': '0', 'data-t-dur': '3000' },
      two: { 'data-t-start': '3000', 'data-t-dur': '3000' },
    });
    clockOf(h).seek(4);
    h.panel.setOpen(false);
    const release = beginAuthoredDom(h.canvasEl);
    release();
    assert.equal(h.canvasEl.querySelectorAll(`.${OFF_CLASS}`).length, 0,
      'an export finishing must not re-pose a canvas whose timeline is shut');
    // …and reopening still works, so the nesting did not strand the writer.
    h.panel.setOpen(true);
    assert.ok(painted(h, 'one').classList.contains(OFF_CLASS), 'the clock came back');
  } finally { h.teardown(); }
});

test('destroying a CLOSED panel leaves nothing of the clock behind', () => {
  const h = mount([clip('one', 0, 3), clip('two', 3, 3)]);
  paintSequence(h, 6000, {
    one: { 'data-t-start': '0', 'data-t-dur': '3000' },
    two: { 'data-t-start': '3000', 'data-t-dur': '3000' },
  });
  clockOf(h).seek(4);
  h.panel.setOpen(false);
  h.panel.destroy();
  assert.equal(h.canvasEl.querySelectorAll(`.${OFF_CLASS}`).length, 0, 'no class survived the teardown');
  h.stageEl.remove();
});

// ── plans/179 T11: honest labels ─────────────────────────────────────────────

test('a bar/chip says what it IS - never a bare "Clip"', () => {
  const h = mount(
    [
      { id: 'named', start: 0, dur: 2, lane: 'seq', kind: 'box', name: 'Opening titles' },
      { id: 'worded', start: 2, dur: 2, lane: 'seq', kind: 'text' },
      { id: 'bed', start: 0, dur: '', lane: '', kind: 'audio' },
      { id: 'shape', start: '', dur: '', lane: '', kind: 'path' },
      { id: 'blank', start: '', dur: '', lane: '', kind: 'box' },
      { id: 'empty-words', start: '', dur: '', lane: '', kind: 'text' },
    ] as Box[],
    40, ADD_KINDS, { cfgPatch: { labelField: 'name' } },
  );
  try {
    // The words come off the LIVE canvas, exactly as `mediaOf` does - and the bed is a
    // PROCEDURAL bed (`zzfxm:`), which is the one the Video template ships and the one
    // that has no `data-audio-dur` to fall back on.
    paintSequence(h, 8000, {
      named: { 'data-t-start': '0', 'data-t-dur': '2000' },
      worded: { 'data-t-start': '2000', 'data-t-dur': '2000' },
      bed: { 'data-t-start': '0' },
      shape: {}, blank: {}, 'empty-words': {},
    });
    painted(h, 'worded').innerHTML =
      '<div class="lolly-box-text">A headline that runs on and on past the budget\nand a second line</div>';
    painted(h, 'bed').innerHTML = '<div class="lolly-box-audio" data-audio-src="zzfxm:20260807"></div>';
    h.panel.setOpen(false);
    h.panel.setOpen(true);

    const barLabel = (id: string): string =>
      h.bar(id).querySelector('.tl-clip-label')!.textContent ?? '';
    const chipLabel = (id: string): string =>
      (h.root.querySelector(`.tl-chip[data-id="${id}"]`) as HTMLElement).textContent ?? '';

    assert.equal(barLabel('named'), 'Opening titles', 'a rename wins over everything');
    assert.equal(barLabel('worded'), 'A headline that runs on…',
      'the FIRST line of the box\u2019s own words, at 24 characters');
    assert.equal(barLabel('bed'), 'Audio', 'the music bed is not "Clip"');
    assert.equal(chipLabel('shape'), 'Shape', 'a pen shape is not "Clip"');
    assert.equal(chipLabel('blank'), 'Box', 'an untimed background box is not "Clip"');
    assert.equal(chipLabel('empty-words'), 'Text', 'nor is a text box that has no words yet');
  } finally { h.teardown(); }
});

test('an artboard chip reads its own name, else its place in the deck', () => {
  const h = mount(
    [
      { id: 'f1', start: '', dur: '', lane: '', kind: 'frame' },
      { id: 'f2', start: '', dur: '', lane: '', kind: 'frame' },
      { id: 'f3', start: '', dur: '', lane: '', kind: 'frame' },
    ] as Box[],
    40, ADD_KINDS, { cfgPatch: { labelField: 'name' } },
  );
  try {
    // The pages the hook emits, in the deck's own page order (`frameGroupsFor` sorts
    // before it emits, so DOM order IS the numbering the canvas and presenter use).
    for (const [fid, name] of [['f1', ''], ['f2', 'Agenda'], ['f3', '']] as const) {
      const page = h.canvasEl.ownerDocument!.createElement('div');
      page.className = 'lolly-frame-page';
      page.setAttribute('data-frame-id', fid);
      if (name) page.setAttribute('data-frame-name', name);
      h.canvasEl.appendChild(page);
    }
    h.panel.setOpen(false);
    h.panel.setOpen(true);
    const chip = (id: string): string =>
      (h.root.querySelector(`.tl-chip[data-id="${id}"]`) as HTMLElement).textContent ?? '';
    assert.equal(chip('f1'), 'Slide 1');
    assert.equal(chip('f2'), 'Agenda', 'a named board says its name, never its number');
    assert.equal(chip('f3'), 'Slide 3');
  } finally { h.teardown(); }
});

test('the audio row is titled, and its bar is classified for the waveform', () => {
  const h = mount([overlay('bed', 0, 4), overlay('card', 0, 4)]);
  try {
    paintSequence(h, 8000, { bed: { 'data-t-start': '0', 'data-t-dur': '4000' }, card: { 'data-t-start': '0', 'data-t-dur': '4000' } });
    painted(h, 'bed').innerHTML = '<div class="lolly-box-audio" data-audio-src="zzfxm:20260807"></div>';
    h.panel.setOpen(false);
    h.panel.setOpen(true);

    const lane = h.bar('bed').closest('.tl-lane') as HTMLElement;
    assert.ok(lane.classList.contains('tl-lane-audio'), 'the sound row is marked');
    assert.equal(lane.querySelector('.tl-lane-label')?.textContent, 'Audio', 'and titled');
    // The row that is NOT sound keeps its unlabelled lane - the title is information,
    // not decoration.
    const other = h.bar('card').closest('.tl-lane') as HTMLElement;
    assert.equal(other.querySelector('.tl-lane-label'), null);

    // The waveform branch. A procedural bed resolves to its own id as its url, so the
    // classification the thumb pass routes on is `audio` + a url - which is exactly
    // `thumbMode`'s waveform case. (peaks() itself needs a real decoder; what is
    // checked here is that the pass reaches it, which is the half jsdom can see.)
    assert.equal(h.bar('bed').dataset.kind, 'audio');
    assert.equal(thumbMode('audio', 'zzfxm:20260807', ''), 'waveform');
  } finally { h.teardown(); }
});

// ── plans/179 T12: the panel fits the viewport ───────────────────────────────

test('the timeline panel CSS contract: a capped panel over a scrolling lanes region', () => {
  // jsdom has no layout, so the fold this defends cannot be reproduced by measuring
  // (every rect is 0). The contract is therefore asserted against the stylesheet
  // itself - the `a11y-prefs-contract.test.ts` precedent - because both halves are
  // one-line CSS facts and both were silently absent:
  //
  //   • `.tl-tracks` is a flex item whose `min-height` defaults to `auto`, i.e. "never
  //     smaller than my content". Its own `overflow-y: auto` therefore never had
  //     anything to scroll, and the surplus went out of the panel's bottom edge, taking
  //     the "Always on" strip below the fold on a 1009px-tall viewport.
  //   • `.tl-panel` is absolutely positioned in a `position: relative` stage that is
  //     itself `100dvh`, so `max-height: 100%` IS "the viewport minus the top chrome".
  const css = readFileSync(new URL('../styles/parts/timeline.css', import.meta.url), 'utf8');
  const block = (sel: string): string => {
    const at = css.indexOf(`\n${sel} {`);
    assert.ok(at >= 0, `${sel} is styled`);
    return css.slice(at, css.indexOf('\n}', at));
  };
  const tracks = block('.tl-tracks');
  assert.match(tracks, /min-height:\s*0\s*;/, '.tl-tracks must be allowed to shrink');
  assert.match(tracks, /overflow-y:\s*auto\s*;/, '…so that its own scroller engages');
  assert.match(block('.tl-panel'), /max-height:\s*100%\s*;/,
    '.tl-panel is capped to the stage, which is the viewport minus the top chrome');
  // And the floor still clears the panel's own chrome, so the cap can never squeeze
  // the tracks to nothing: clampPanelH owns that end and is unchanged.
  assert.ok(clampPanelH(0, 1009, 120) >= 120 + ONE_LANE_H, 'the resize floor still clears the chrome');
});

// ── the Appears row is a row, not a label (a11y / mis-click) ──────────────────

test('clicking the words "Appears" presses nothing - the row is not a <label>', () => {
  // `<button>` is a labelable element, so inside a `<label>` the FIRST segment becomes
  // the labelled control and label activation fires it. Reading the row therefore
  // committed "With the slide", whose exclusive patch clears start, dur, lane and build
  // in one go - a box losing its whole timeline placement with nothing pressed on screen.
  const h = mount([{ id: 'a', start: 12, dur: 3, lane: 'seq' }]);
  try {
    h.select(['a']);
    const seg = inspEl<HTMLElement>('.tl-appear-seg')!;
    const row = seg.parentElement!;
    assert.equal(row.tagName, 'DIV', 'the Appears row must not be a <label>');
    const label = row.querySelector<HTMLElement>('.field-label')!;
    assert.equal(label.textContent, 'Appears');
    label.click();
    assert.equal(h.commits.length, 0, 'reading the row is not an edit');
    assert.equal(appearBtns(h.root).find((b) => b.dataset.val === 'time')!.getAttribute('aria-pressed'), 'true',
      'and the box is still timed');
  } finally { h.teardown(); }
});

test('the Enter select is named "Enter", not "Enter Preview this motion"', () => {
  // The preview button lives inside the Enter row's <label>, and a labelled control takes
  // its accessible name from the WHOLE label subtree - so the button's own aria-label was
  // read out as part of the select's name.
  const h = mount([clip('a', 0, 3)]);
  try {
    h.select(['a']);
    const sel = field(h.root, 'Enter') as unknown as HTMLSelectElement;
    assert.equal(sel.getAttribute('aria-label'), 'Enter');
  } finally { h.teardown(); }
});

// ── the preview reaches the boxes it was built for ───────────────────────────

test('canPlayOnce accepts the PRESENTER-only entrance an untimed box carries', () => {
  const doc = dom.window.document;
  const mk = (attrs: Record<string, string>): HTMLElement => {
    const el = doc.createElement('div');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  // A box that appears "with the slide" or "on click" is stamped `data-pr-enter` and
  // never `data-t-enter` - widening the timeline name would change what a video renders.
  // Asking for the timeline name alone hid the preview from every slide-deck box.
  assert.equal(canPlayOnce(mk({ 'data-pr-enter': 'fade' })), true);
  assert.equal(canPlayOnce(mk({ 'data-t-enter': 'fade' })), true);
  assert.equal(canPlayOnce(mk({ 'data-pr-enter': 'none' })), false, 'a cut is not an entrance');
  assert.equal(canPlayOnce(mk({ 'data-pr-enter': 'wobble' })), false, 'nor is a kind nothing renders');
  assert.equal(canPlayOnce(mk({})), false);
});

test('playOnce borrows the presenter-only names for the ramp and hands them back', async () => {
  const doc = dom.window.document;
  const canvas = doc.createElement('div');
  const el = doc.createElement('div');
  el.className = 'lolly-box';
  el.setAttribute('data-pr-enter', 'fade');
  el.setAttribute('data-pr-enter-ms', '400');
  el.setAttribute('style', 'left:0px;top:0px');
  canvas.appendChild(el);
  doc.body.appendChild(canvas);
  try {
    let now = 0;
    let pending: (() => void) | null = null;
    const done = playOnce(el, 400, { now: () => now, schedule: (fn) => { pending = fn; return () => { pending = null; }; } });
    assert.equal(el.getAttribute('data-t-enter'), 'fade', 'the applier only reads the timeline name');
    assert.equal(el.style.opacity, '0', 'so the entrance actually runs');
    now = 400;
    pending!();
    await done;
    assert.equal(el.hasAttribute('data-t-enter'), false, 'borrowed, not kept');
    assert.equal(el.hasAttribute('data-t-enter-ms'), false);
    assert.equal(el.getAttribute('data-pr-enter'), 'fade', 'and the box keeps its own');
    // Declaration-identical, not byte-identical: writing through CSSStyleDeclaration
    // re-serialises the whole attribute, which the applier documents.
    assert.equal(el.style.opacity, '', 'and nothing composed is left on it');
    assert.equal(el.style.transform, '');
    assert.equal(el.style.left, '0px');
  } finally { canvas.remove(); }
});

test('playOnce refuses a SECOND preview while one is running', async () => {
  // Two sessions over one root: the newer suspends the older, and the older's restore
  // then strips `seq-off` across the whole stage - every box that has not started yet
  // flashes on screen for a frame. The navigator's chip already refused a second press.
  const doc = dom.window.document;
  const host = doc.createElement('div');
  host.innerHTML = `<div class="artboard" data-sequence data-seq-ms="4000">
    <div class="lolly-box" id="one" data-t-start="0" data-t-enter="fade" data-t-enter-ms="400" style="left:0px"></div>
    <div class="lolly-box" id="two" data-t-start="0" data-t-enter="fade" data-t-enter-ms="400" style="left:0px"></div>
  </div>`;
  doc.body.appendChild(host);
  const one = doc.getElementById('one') as HTMLElement;
  const two = doc.getElementById('two') as HTMLElement;
  try {
    let now = 0;
    let pending: (() => void) | null = null;
    const first = playOnce(one, 400, { now: () => now, schedule: (fn) => { pending = fn; return () => { pending = null; }; } });
    assert.equal(one.style.opacity, '0', 'the first ramp is running');
    let started = 0;
    await playOnce(two, 400, { now: () => 0, schedule: (fn) => { started++; return () => { void fn; }; } });
    assert.equal(started, 0, 'the second press never opened a session of its own');
    now = 400;
    pending!();
    await first;
    assert.equal(one.style.opacity, '', 'and the first still hands its element back');
    // …and once nothing is running, a preview is offered again.
    let n2 = 0;
    let p2: (() => void) | null = null;
    const third = playOnce(two, 400, { now: () => n2, schedule: (fn) => { p2 = fn; return () => { p2 = null; }; } });
    assert.equal(two.style.opacity, '0', 'not a one-shot latch');
    n2 = 400;
    p2!();
    await third;
  } finally { host.remove(); }
});

test("right-clicking a clip with a source file offers Download, and it saves the asset bytes under the asset name", async () => {
  // Andy, 2026-09-03: make it easy to get a clip's audio, video or image out of the sequence.
  const saved: Array<{ name: string; type: string }> = [];
  const base = fakeHost().host as unknown as Record<string, unknown>;
  const download = async (blob: Blob, name: string): Promise<void> => { saved.push({ name, type: blob.type }); };
  const host = { ...base, export: { download } };
  const realFetch = globalThis.fetch;
  (globalThis as { fetch: unknown }).fetch = async () => ({ blob: async () => new Blob(['RIFF'], { type: 'audio/wav' }) });
  const h = mount([
    { id: 'a', start: 0, dur: 3, lane: 'seq', image: { id: 'user/tts/1', meta: { name: 'Take one' } } } as never,
  ], 40, ADD_KINDS, { assetField: 'image', host });
  try {
    await frames(2);
    rightClick(h.root.querySelector('.tl-clip[data-id="a"]')!);
    const menu = openMenu('.tl-ctx-menu');
    assert.ok(menu, 'a context menu opened');
    assert.ok(menuLabels(menu).includes('Download'), 'the clip carries a source file, so Download is offered; got: ' + menuLabels(menu).join(', '));
    const item = Array.from(menu!.querySelectorAll<HTMLElement>('.tl-menu-label')).find((n) => n.textContent === 'Download')!;
    click(item.closest('button') ?? item);
    await frames(4);
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(saved, [{ name: 'Take one.wav', type: 'audio/wav' }], "the asset name, the extension from its bytes");
  } finally {
    (globalThis as { fetch: unknown }).fetch = realFetch;
    closeOverlays(); h.teardown();
  }
});
