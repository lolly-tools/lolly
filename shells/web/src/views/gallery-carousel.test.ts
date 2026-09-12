// SPDX-License-Identifier: MPL-2.0
/**
 * A COLD GALLERY TILE HAS TO SAY WHAT IT IS BEFORE ITS LOOKS EXIST.
 *
 * Each look in a tile's example strip is a live render, so for the first second or two
 * of a cold grid the strip is skeleton panes. The strip used to stay silent through
 * that window - no dots, arrows only on hover - so a tile read as "nothing here yet"
 * and a dot jump could park it on an empty pane (plans/246).
 *
 * The fix is one invariant, and these tests are its teeth: the nav and the dot row come
 * from the look COUNT (known from the manifest before the first render starts), every
 * dot starts pending, and pending clears in the SAME place the look's `load` handler
 * runs - or in its error path, so a dead look never breathes forever. Nothing may step
 * onto a pane with no art, and nothing may grow the DOM as looks arrive, because a docs
 * capture settles on the DOM holding still.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/gallery-carousel.test.ts
 */
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  CAR_FAILED_ATTR, CAR_INERT_ATTR, CAR_PENDING_ATTR, advanceCarousel, carouselDotsMarkup, carouselNavMarkup,
  markLookFailed, markLookReady, readyCarIndices, setCarDot, stripCarouselNav, syncCarState, wireCarousel,
} from './gallery-carousel.ts';
import { LOOK_PENDING_ATTR } from '../lib/capture-neutral.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, '..', 'styles', 'parts', 'gallery.css'), 'utf8');
const VIEW = readFileSync(join(HERE, 'gallery.ts'), 'utf8');

const SLIDE_W = 300;

/**
 * A wired strip of `count` example looks, exactly as `cardMarkup` composes it: the
 * track of skeleton slides, then the nav and the dots the module builds from the count.
 * jsdom has no layout and no scrolling, so the track's width and `scrollTo` are modelled
 * - the real carousel reads both.
 */
function strip(t: TestContext, count: number) {
  const dom = new JSDOM('<!doctype html><div class="tool-masonry"></div>', { url: 'http://localhost/' });
  const win = dom.window;
  Object.assign(globalThis, { window: win, document: win.document });
  t.after(() => { win.close(); });
  const slides = Array.from({ length: count }, (_, i) =>
    `<li class="gcar-slide gcar-slide--ex" data-ex-index="${i}"><a class="gcar-open" href="#/tool/demo"><img class="gcar-img" alt=""></a></li>`).join('');
  win.document.querySelector('.tool-masonry')!.innerHTML =
    `<article class="gtile"><div class="gcar" data-tool="demo">`
    + `<ol class="gcar-track">${slides}</ol>${carouselNavMarkup(count)}${carouselDotsMarkup(count)}`
    + `</div></article>`;
  const gcar = win.document.querySelector<HTMLElement>('.gcar')!;
  const track = gcar.querySelector<HTMLElement>('.gcar-track')!;
  let scrollLeft = 0;
  Object.defineProperties(track, {
    clientWidth: { get: () => SLIDE_W },
    scrollLeft: { get: () => scrollLeft, set: (v: number) => { scrollLeft = v; } },
  });
  track.scrollTo = ((opts: { left?: number }) => { scrollLeft = opts.left ?? 0; }) as typeof track.scrollTo;
  wireCarousel(gcar);
  const click = (sel: string): void => {
    gcar.querySelector<HTMLElement>(sel)!.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  return {
    win, gcar, track,
    slides: () => [...track.querySelectorAll<HTMLElement>('.gcar-slide')],
    dots: () => [...gcar.querySelectorAll<HTMLElement>('.gcar-dot')],
    nav: () => [...gcar.querySelectorAll<HTMLElement>('.gcar-nav')],
    pending: () => gcar.querySelectorAll(`[${CAR_PENDING_ATTR}]`).length,
    nodes: () => gcar.querySelectorAll('*').length,
    click,
    /** The slide index the strip is parked on. */
    at: () => Math.round(scrollLeft / SLIDE_W),
  };
}

test('the nav and the dot row come from the look COUNT, before a single look renders', (t) => {
  const s = strip(t, 3);
  assert.equal(s.dots().length, 3, 'three looks ⇒ three dots in the first paint');
  assert.equal(s.nav().length, 2, 'both arrows are mounted with the strip');
  // Nothing has rendered: every dot says so, and the arrows advertise that there is
  // nowhere to step yet rather than appearing later out of nowhere.
  assert.equal(s.pending(), 3);
  assert.deepEqual(s.nav().map((b) => b.hasAttribute(CAR_INERT_ATTR)), [true, true]);
  assert.deepEqual(s.slides().map((sl) => sl.classList.contains('is-loaded')), [false, false, false]);
  assert.ok(s.dots()[0]!.classList.contains('is-active'), 'the first dot is the position indicator from the start');
});

test('one look gets no dots and no arrows - there is nowhere to step', () => {
  assert.equal(carouselDotsMarkup(1), '');
  assert.equal(carouselNavMarkup(1), '');
  assert.equal(carouselDotsMarkup(0), '');
  assert.equal(carouselNavMarkup(0), '');
});

test('a dot leaves the pending state when its look loads, and the node count never moves', (t) => {
  const s = strip(t, 3);
  const before = s.nodes();
  markLookReady(s.gcar, s.slides()[1]!);
  assert.equal(s.dots()[1]!.hasAttribute(CAR_PENDING_ATTR), false, 'the loaded look\'s own dot clears');
  assert.deepEqual(s.dots().map((d) => d.hasAttribute(CAR_PENDING_ATTR)), [true, false, true], 'and only that one');
  assert.ok(s.gcar.classList.contains('has-art'), 'the tile stops its waiting tracer');
  // The docs capture settles on the DOM holding still (lib/capture-neutral.ts), so the
  // pending state must be an attribute flip and never a node added or taken away.
  assert.equal(s.nodes(), before);
  markLookReady(s.gcar, s.slides()[0]!);
  markLookReady(s.gcar, s.slides()[2]!);
  assert.equal(s.pending(), 0);
  assert.equal(s.nodes(), before);
});

test('a look that FAILS clears pending too, so no dot breathes forever', (t) => {
  const s = strip(t, 2);
  markLookFailed(s.gcar, s.slides()[0]!);
  const dot = s.dots()[0]!;
  assert.equal(dot.hasAttribute(CAR_PENDING_ATTR), false, 'the failed look is no longer pending');
  assert.ok(dot.hasAttribute(CAR_FAILED_ATTR), 'it is marked failed instead - that pane stays empty');
  assert.equal(s.pending(), 1, 'the look still rendering is untouched');
  // A render that threw and an <img> that errored are the same story to the strip.
  markLookFailed(s.gcar, s.slides()[1]!);
  assert.equal(s.pending(), 0, 'a strip whose every look failed holds nothing pending');
});

test('a look that arrives after its render failed takes the ready state back', (t) => {
  const s = strip(t, 2);
  markLookFailed(s.gcar, s.slides()[0]!);
  markLookReady(s.gcar, s.slides()[0]!);
  assert.deepEqual(
    [s.dots()[0]!.hasAttribute(CAR_PENDING_ATTR), s.dots()[0]!.hasAttribute(CAR_FAILED_ATTR)], [false, false],
    'ready wins - the image decoded, whatever happened before it',
  );
});

test('advance steps only READY looks, skipping the panes still rendering', (t) => {
  const s = strip(t, 4);
  markLookReady(s.gcar, s.slides()[0]!);
  markLookReady(s.gcar, s.slides()[2]!);          // slides 1 and 3 are still pending
  advanceCarousel(s.gcar, 1, true);
  assert.equal(s.at(), 2, 'next jumps over the pending pane to the next decoded look');
  advanceCarousel(s.gcar, 1, true);
  assert.equal(s.at(), 0, 'and wraps within the ready set');
  advanceCarousel(s.gcar, -1, true);
  assert.equal(s.at(), 2, 'prev walks the same set backwards');
  assert.ok(s.dots()[2]!.classList.contains('is-active'), 'the dots follow the step');
  // The third look arrives: it joins the rotation with no re-wiring.
  markLookReady(s.gcar, s.slides()[3]!);
  advanceCarousel(s.gcar, 1, true);
  assert.equal(s.at(), 3);
});

test('with only the cover ready the arrows are inert: marked, and no hop', (t) => {
  const s = strip(t, 3);
  markLookReady(s.gcar, s.slides()[0]!);
  assert.deepEqual(s.nav().map((b) => b.hasAttribute(CAR_INERT_ATTR)), [true, true]);
  s.click('.gcar-next');
  assert.equal(s.at(), 0, 'a click on a disabled arrow moves nothing');
  s.click('.gcar-prev');
  assert.equal(s.at(), 0);
  // A second look decodes and the same arrows become live controls.
  markLookReady(s.gcar, s.slides()[2]!);
  assert.deepEqual(s.nav().map((b) => b.hasAttribute(CAR_INERT_ATTR)), [false, false]);
  s.click('.gcar-next');
  assert.equal(s.at(), 2);
});

test('a dot for a look with no art is inert - a jump there would park on an empty pane', (t) => {
  const s = strip(t, 3);
  markLookReady(s.gcar, s.slides()[0]!);
  markLookFailed(s.gcar, s.slides()[1]!);
  s.click('.gcar-dot[data-i="1"]');
  assert.equal(s.at(), 0, 'the failed look is not a place to land');
  s.click('.gcar-dot[data-i="2"]');
  assert.equal(s.at(), 0, 'nor is the one still rendering');
  markLookReady(s.gcar, s.slides()[2]!);
  s.click('.gcar-dot[data-i="2"]');
  assert.equal(s.at(), 2, 'once it has art, the dot takes you there');
});

test('a lead frame ships real art, so wiring already finds it ready', (t) => {
  const s = strip(t, 2);
  s.slides()[0]!.classList.add('gcar-slide--lead');
  syncCarState(s.gcar);
  assert.deepEqual(s.dots().map((d) => d.hasAttribute(CAR_PENDING_ATTR)), [false, true]);
  assert.deepEqual(readyCarIndices(s.track), [0]);
});

test('syncCarState is idempotent and the single writer of the dots and arrows', (t) => {
  const s = strip(t, 3);
  markLookReady(s.gcar, s.slides()[0]!);
  markLookReady(s.gcar, s.slides()[1]!);
  const snapshot = s.gcar.innerHTML;
  syncCarState(s.gcar);
  syncCarState(s.gcar);
  assert.equal(s.gcar.innerHTML, snapshot, 'repainting state changes nothing that was already true');
  setCarDot(s.gcar, 1);
  assert.deepEqual(s.dots().map((d) => d.classList.contains('is-active')), [false, true, false]);
});

test('a strip that will never rotate drops its nav and dots entirely', (t) => {
  const s = strip(t, 3);
  stripCarouselNav(s.gcar);
  assert.equal(s.dots().length, 0, 'no position indicator for panes that are not coming');
  assert.equal(s.nav().length, 0);
  assert.equal(s.pending(), 0, 'and nothing left pending to hold a docs capture');
});

// ── The surrounding contracts: the view, the sheet, the capture pin ──────────

test('the view builds its nav and dots from the count, and clears pending where the look arrives', () => {
  assert.match(VIEW, /const dots = carouselDotsMarkup\(slideCount\);/);
  assert.match(VIEW, /const nav = carouselNavMarkup\(slideCount\);/);
  // Both halves of the image contract: a decode clears the dot, an error clears it too.
  assert.match(VIEW, /img\.addEventListener\('load', \(\) => markLookReady\(gcar, slide\), \{ once: true \}\);/);
  assert.match(VIEW, /img\.addEventListener\('error', \(\) => markLookFailed\(gcar, slide\), \{ once: true \}\);/);
  // The render's own failure path (a throw before any image src) must clear it as well.
  assert.match(VIEW, /catch \(e\) \{[\s\S]{0,200}markLookFailed\(gcar, slide\);/);
  // A strip with no renders coming loses its nav rather than sitting pending forever.
  assert.match(VIEW, /if \(perfUiOn\(\)\) \{ gcar\.classList\.add\('has-art'\); stripCarouselNav\(gcar\); return; \}/);
  // The other way a look could sit pending for good: a tile with no box (filtered out
  // by a search, or the whole grid in hide-previews mode) parks its render. A capture
  // waits for every look, so under the pin it renders last instead of never.
  assert.match(VIEW, /if \(!rect\.width \|\| !rect\.height\) return captureNeutralPinned\(\) \? 3 : null;/);
});

test('the dots live INSIDE .gcar, which is what hide-previews mode already hides', (t) => {
  const s = strip(t, 3);
  assert.ok(s.gcar.querySelector('.gcar-dots')?.parentElement === s.gcar, 'the dot row is a child of the strip');
  assert.ok(s.gcar.querySelector('.gcar-nav')?.parentElement === s.gcar);
  // "Hide colourful previews" collapses a tile to icon + text by dropping the whole
  // strip - so the new dots must not need a rule of their own to stay hidden.
  assert.match(CSS, /html\[data-a11y-previews="hidden"\] \.tool-masonry \.gcar \{ display: none; \}/);
  assert.equal(
    /\[data-a11y-previews="hidden"\][^{]*\.gcar-dot/.test(CSS), false,
    'the dots are hidden by the strip rule above, not by a second rule that could drift from it',
  );
});

test('the pending and failed dot states are styled, and only the pulse is motion', () => {
  // Both states share one appearance rule, and both are out of the hit test.
  const block = /\.gcar-dot\[data-look-pending\],\s*\.gcar-dot\[data-failed\] \{([^}]*)\}/.exec(CSS);
  assert.ok(block, 'gallery.css carries no pending/failed dot rule');
  assert.match(block![1]!, /pointer-events: none/);
  assert.match(block![1]!, /background:/);
  // The dim fill alone would vanish on a pale skeleton pane: the hairline is what makes
  // a pending dot readable there, which is the whole reason a cold strip looked empty.
  assert.match(block![1]!, /outline: 1px solid hsl\(var\(--foreground\)[^;]*\)/);
  // Nothing in the STATIC state animates; the pulse is its own rule, so base.css's
  // reduced-motion blocks (OS query and app pref alike) leave a legible dot behind.
  assert.equal(/animation/.test(block![1]!), false);
  assert.match(CSS, /\.gcar-dot\[data-look-pending\] \{ animation: gcar-dot-wait [^}]*\}/);
  assert.match(CSS, /@keyframes gcar-dot-wait/);
  // An inert arrow is visibly inert and does not light up under the pointer.
  assert.match(CSS, /\.gcar-nav\[data-nav-inert\] \{ cursor: default; \}/);
  assert.match(CSS, /\.gcar-nav\[data-nav-inert\]:hover \{ background: rgba\(0, 0, 0, \.42\); \}/);
});

test('the inert arrow is a DATA attribute, because the arrows are aria-hidden', () => {
  // These arrows carry aria-hidden and tabindex="-1" by design: the card's own link is
  // what assistive tech is offered, and the strip is decorative beside it. An
  // aria-disabled on a node no accessibility tree contains would be an ARIA name worn
  // by a CSS hook - so the inert state says what it is instead.
  assert.equal(CAR_INERT_ATTR, 'data-nav-inert');
  assert.match(carouselNavMarkup(2), /tabindex="-1" aria-hidden="true" data-nav-inert /);
  assert.equal(/aria-disabled/.test(carouselNavMarkup(2)), false, 'no ARIA state on an aria-hidden control');
  assert.equal(
    /\.gcar-nav\[aria-disabled/.test(CSS), false,
    'and the sheet paints the data attribute, so the two cannot drift',
  );
});

test('the strip and the capture pin share ONE name for pending, and it is look-specific', () => {
  assert.equal(CAR_PENDING_ATTR, LOOK_PENDING_ATTR);
  // Named for looks, not for pending-in-general: a bare `data-pending` is already the
  // annotate tool's own template attribute, and the capture settle waits on every
  // element carrying this name - so an unnamespaced one would make a tool's private
  // state hold a docs capture open.
  assert.equal(CAR_PENDING_ATTR, 'data-look-pending');
  // A capture that stamped the frame final while a look was still rendering is exactly
  // the race the attribute exists to close, so the two must never drift.
  assert.match(carouselDotsMarkup(2), new RegExp(`<button class="gcar-dot is-active" type="button" data-i="0" ${LOOK_PENDING_ATTR} `));
});
