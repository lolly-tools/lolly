// SPDX-License-Identifier: MPL-2.0
/**
 * preview-media.ts - the preview element and the ONE motion-playback policy behind it
 * (plans/155 WP-5.3).
 *
 * Run directly:  node --test shells/web/src/lib/preview-media.test.ts
 *
 * The invariant every case here defends is that MOTION COSTS NOTHING UNTIL INTENT. A
 * gallery of 67 tiles that quietly fetches 67 clips is the regression this policy exists
 * to prevent, and it is invisible in a screenshot - so the tests assert on what the markup
 * asks the network for (`src`, `preload`, `autoplay`) rather than on how anything looks.
 *
 * The three off-switches are asserted separately and both ways: with each one on, a play
 * call must leave the element byte-identical to its resting state, and with all of them off
 * the same call must actually start something. A gate that silently stopped gating would
 * otherwise pass every "it plays" test in this file.
 *
 * jsdom with a real origin, matching lib/a11y-prefs.test.ts (this module reads the same
 * <html> data attributes, and prefersReducedMotion needs a controllable matchMedia since
 * jsdom implements none). HTMLMediaElement.play is likewise unimplemented in jsdom, so it
 * is stubbed into a counter - which is exactly what "did this play?" wants to assert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

// Controllable pointer/motion media queries. `hover: hover` decides which half of the
// policy arms, so every arm test states which device it is describing.
let osReduceMotion = false;
let hoverCapable = true;
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  get matches() {
    if (q.includes('prefers-reduced-motion')) return osReduceMotion;
    return hoverCapable;
  },
  media: q,
  addEventListener() {},
  removeEventListener() {},
});

// jsdom has no media pipeline; play()/pause() are what the policy drives, so count them.
const played: HTMLVideoElement[] = [];
dom.window.HTMLMediaElement.prototype.play = function play(this: HTMLVideoElement) {
  played.push(this);
  return Promise.resolve();
};
dom.window.HTMLMediaElement.prototype.pause = function pause() { /* no pipeline to stop */ };

// A minimal IntersectionObserver: the coarse branch's only dependency, driven by hand so a
// test can say which tiles are visible without a layout engine.
type IoCb = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
const observers: Array<{ cb: IoCb; targets: Set<Element>; disconnected: boolean }> = [];
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
  targets = new Set<Element>();
  disconnected = false;
  cb: IoCb;
  constructor(cb: IoCb) { this.cb = cb; observers.push(this); }
  observe(el: Element): void { this.targets.add(el); }
  unobserve(el: Element): void { this.targets.delete(el); }
  disconnect(): void { this.disconnected = true; }
};

const {
  previewMedia, motionVideoThumb, motionKind, motionPreviewsSuppressed,
  playMotionPreview, stopMotionPreview, playMotionIn, stopMotionIn, armMotionPreviews,
} = await import('./preview-media.ts');

const POSTER = '/catalog/previews/flythrough.svg';
const WEBM = '/tools/flythrough/card.webm';
const APNG = '/tools/pose-geeko/card.png';

function reset(): void {
  played.length = 0;
  observers.length = 0;
  osReduceMotion = false;
  hoverCapable = true;
  delete document.documentElement.dataset.a11yMotion;
  delete document.documentElement.dataset.a11yPreviews;
  document.body.innerHTML = '';
}

/** One tile: a card wrapper holding exactly one preview element, which is the shape the
 *  hover/focus walk-up looks for on every surface. */
function tile(html: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'tile';
  card.innerHTML = html;
  document.body.append(card);
  return card;
}

// ── markup ──────────────────────────────────────────────────────────────────

test('a still preview is unchanged - no motion attributes at all', () => {
  reset();
  const html = previewMedia(POSTER, 'gtile-hero-img');
  assert.ok(html.startsWith('<img '), 'still previews stay a plain <img>');
  assert.ok(!html.includes('data-motion'), 'no marker without an anim file');
  assert.ok(html.includes('loading="lazy"'));
});

test('an animated preview ships the STATIC file as src and parks motion in a data attribute', () => {
  reset();
  const html = previewMedia(POSTER, 'gtile-hero-img', undefined, false, WEBM);
  assert.ok(html.includes(`src="${POSTER}"`), 'src is the poster, never the clip');
  assert.ok(!new RegExp(`\\ssrc="${WEBM}"`).test(html), 'the clip is not requested by the markup');
  assert.ok(html.includes('data-motion="video"'));
  assert.ok(html.includes(`data-motion-src="${WEBM}"`));
  assert.ok(html.includes(`data-motion-poster="${POSTER}"`), 'both URLs are on the element');
});

test('an APNG anim is marked raster - it animates in the <img> and needs the poster to pause', () => {
  reset();
  const html = previewMedia(POSTER, 'x', undefined, false, APNG);
  assert.ok(html.includes('data-motion="raster"'));
  assert.equal(motionKind(APNG), 'raster');
  assert.equal(motionKind(WEBM), 'video');
});

test('eager keeps its LCP hints when a motion file is present', () => {
  reset();
  const html = previewMedia(POSTER, 'x', undefined, true, WEBM);
  assert.ok(html.includes('loading="eager"') && html.includes('fetchpriority="high"'),
    'the poster is still the element racing for LCP');
});

test('an HTML card ignores anim - a sandboxed iframe has no src to swap', () => {
  reset();
  const html = previewMedia('/tools/digi-ad/card.html', 'x', undefined, false, WEBM);
  assert.ok(html.startsWith('<iframe '));
  assert.ok(!html.includes('data-motion'));
});

test('a hostile anim URL is escaped, not emitted verbatim', () => {
  reset();
  const evil = '/x.webm" onerror="alert(1)';
  const html = previewMedia(POSTER, 'x', undefined, false, evil);
  assert.ok(!html.includes('onerror="'), `the quote that would break out is escaped: ${html}`);
  assert.ok(html.includes('&quot;'));
});

test('an asset video thumbnail asks the network for nothing and does not autoplay', () => {
  reset();
  const html = motionVideoThumb('/catalog/assets/clip.mp4', 'cat-thumb');
  assert.ok(html.includes('preload="none"'), 'the pre-WP-5.3 markup was preload="metadata"');
  assert.ok(!html.includes('autoplay'), 'the pre-WP-5.3 markup autoplayed every tile');
  assert.ok(html.includes('muted') && html.includes('loop') && html.includes('playsinline'));
  assert.ok(html.includes('data-motion="video"'), 'so the arm can find and gate it');
});

// ── the off-switches ────────────────────────────────────────────────────────

test('each of the three motion off-switches suppresses playback on its own', () => {
  reset();
  assert.equal(motionPreviewsSuppressed(), false, 'nothing on: motion is allowed');

  osReduceMotion = true;
  assert.equal(motionPreviewsSuppressed(), true, 'OS prefers-reduced-motion');
  osReduceMotion = false;

  document.documentElement.dataset.a11yMotion = 'reduce';
  assert.equal(motionPreviewsSuppressed(), true, 'the app pref');
  delete document.documentElement.dataset.a11yMotion;

  document.documentElement.dataset.a11yPreviews = 'hidden';
  assert.equal(motionPreviewsSuppressed(), true, 'hide colourful previews');
  delete document.documentElement.dataset.a11yPreviews;

  assert.equal(motionPreviewsSuppressed(), false, 'and each one clears again');
});

test('with motion suppressed a play leaves the element byte-identical and loads nothing', () => {
  for (const set of [
    () => { osReduceMotion = true; },
    () => { document.documentElement.dataset.a11yMotion = 'reduce'; },
    () => { document.documentElement.dataset.a11yPreviews = 'hidden'; },
  ]) {
    reset();
    set();
    const card = tile(previewMedia(POSTER, 'x', undefined, false, WEBM));
    const before = card.innerHTML;
    playMotionIn(card);
    assert.equal(card.innerHTML, before, 'no <video> created, no src swapped');
    assert.equal(card.querySelectorAll('video').length, 0);
    assert.equal(played.length, 0);

    // The APNG path is the one that cannot pause itself, so it gets its own assertion.
    reset();
    set();
    const apngCard = tile(previewMedia(POSTER, 'x', undefined, false, APNG));
    playMotionIn(apngCard);
    assert.equal(apngCard.querySelector('img')!.getAttribute('src'), POSTER,
      'the APNG is never swapped in, so its bytes are never fetched');
  }
  reset();
});

// ── play / stop ─────────────────────────────────────────────────────────────

test('a raster (APNG) preview swaps to the motion file and back to the poster', () => {
  reset();
  const card = tile(previewMedia(POSTER, 'x', undefined, false, APNG));
  const img = card.querySelector('img')!;
  playMotionIn(card);
  assert.equal(img.getAttribute('src'), APNG);
  stopMotionIn(card);
  assert.equal(img.getAttribute('src'), POSTER, 'the still sibling IS the pause state');
});

test('a webm preview upgrades to a <video> on play and is torn back down on stop', () => {
  reset();
  const card = tile(previewMedia(POSTER, 'gtile-hero-img', undefined, false, WEBM));
  const img = card.querySelector('img')!;
  playMotionIn(card);
  const video = card.querySelector('video')!;
  assert.ok(video, 'a real video element is created only now');
  assert.equal(video.getAttribute('src'), WEBM);
  assert.equal(video.getAttribute('poster'), POSTER, 'poster = the frame already on screen, so no flash');
  assert.equal(video.className, img.className, 'it inherits the box the img had');
  assert.ok(video.muted && video.loop, 'muted+loop, or a browser refuses to start it');
  assert.ok(img.hidden);
  assert.equal(played.length, 1);
  assert.equal(video.dataset.motion, undefined, 'only the img keeps the marker');

  playMotionIn(card);
  assert.equal(card.querySelectorAll('video').length, 1, 'play is idempotent');

  stopMotionIn(card);
  assert.equal(card.querySelectorAll('video').length, 0, 'the element is removed, not parked');
  assert.equal(img.hidden, false);
  assert.equal(img.getAttribute('src'), POSTER);
});

test('only one preview in the app moves at a time, across surfaces and across drivers', () => {
  reset();
  // The gallery drives hover from its own tile hook while the arm drives focus, and a picker
  // opens over a gallery that is still playing - so the guard cannot live in either one.
  const galleryTile = tile(motionVideoThumb('/gallery.mp4', 'x'));
  const pickerTile = tile(motionVideoThumb('/picker.mp4', 'x'));
  let galleryPaused = 0;
  galleryTile.querySelector('video')!.pause = () => { galleryPaused++; };

  playMotionIn(galleryTile);
  playMotionIn(pickerTile);
  assert.equal(galleryPaused, 1, 'starting the second stopped the first');
  assert.deepEqual(played.map(v => v.getAttribute('src')), ['/gallery.mp4', '/picker.mp4']);
});

test('stopping a never-started asset video does not seek it (a seek would fetch)', () => {
  reset();
  const card = tile(motionVideoThumb('/clip.mp4', 'cat-thumb'));
  const video = card.querySelector('video')!;
  let seeks = 0;
  Object.defineProperty(video, 'currentTime', { get: () => 0, set: () => { seeks++; } });
  stopMotionPreview(video);
  assert.equal(seeks, 0);
});

// ── the arm: hover / focus ──────────────────────────────────────────────────

test('pointer-fine: hovering a tile plays it, leaving stops it, and only one plays at a time', () => {
  reset();
  hoverCapable = true;
  const a = tile(motionVideoThumb('/a.mp4', 'cat-thumb'));
  const b = tile(motionVideoThumb('/b.mp4', 'cat-thumb'));
  const arm = armMotionPreviews(document.body);
  const va = a.querySelector('video')!, vb = b.querySelector('video')!;

  a.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(played, [va]);

  // Moving inside the SAME card (image to caption) is not a leave.
  const out = new dom.window.Event('pointerout', { bubbles: true });
  Object.defineProperty(out, 'relatedTarget', { value: va });
  a.dispatchEvent(out);
  assert.equal(played.length, 1, 'nothing restarted, nothing stopped');

  b.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(played, [va, vb], 'the second tile takes over');
  assert.equal(observers.length, 0, 'a hover device arms no observer');
  arm.destroy();
});

test('keyboard focus plays a tile on every device, including one with no hover', () => {
  reset();
  hoverCapable = false;
  const card = tile(motionVideoThumb('/a.mp4', 'cat-thumb'));
  const arm = armMotionPreviews(document.body);
  card.dispatchEvent(new dom.window.Event('focusin', { bubbles: true }));
  assert.equal(played.length, 1, 'focus is intent even where hover does not exist');
  arm.destroy();
});

test('hover:false leaves hover to the surface own hook (the gallery prefetch listener)', () => {
  reset();
  hoverCapable = true;
  const card = tile(motionVideoThumb('/a.mp4', 'cat-thumb'));
  const arm = armMotionPreviews(document.body, { hover: false });
  card.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.equal(played.length, 0, 'no delegated hover, so no double play');
  card.dispatchEvent(new dom.window.Event('focusin', { bubbles: true }));
  assert.equal(played.length, 1, 'focus is still wired');
  arm.destroy();
});

test('destroy stops whatever is playing and disconnects the observer', () => {
  reset();
  hoverCapable = true;
  const card = tile(motionVideoThumb('/a.mp4', 'cat-thumb'));
  const arm = armMotionPreviews(document.body);
  card.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  let paused = 0;
  card.querySelector('video')!.pause = () => { paused++; };
  arm.destroy();
  assert.equal(paused, 1);
  card.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.equal(played.length, 1, 'the listeners are gone');
});

// ── the arm: coarse / touch ─────────────────────────────────────────────────

test('coarse: only the most-centered visible tile plays, and it hands over on scroll', () => {
  reset();
  hoverCapable = false;
  const near = tile(motionVideoThumb('/near.mp4', 'cat-thumb'));
  const far = tile(motionVideoThumb('/far.mp4', 'cat-thumb'));
  // window.innerHeight is 768 in jsdom, so the viewport middle is 384.
  const rect = (top: number) => () => ({ top, height: 100, bottom: top + 100, left: 0, right: 0, width: 100, x: 0, y: top, toJSON() {} });
  near.getBoundingClientRect = rect(330) as never;   // centre 380, 4px off the middle
  far.getBoundingClientRect = rect(600) as never;    // centre 650

  const arm = armMotionPreviews(document.body);
  assert.equal(observers.length, 1, 'one observer for the whole surface, not one per tile');
  const io = observers[0]!;
  assert.deepEqual([...io.targets], [near, far], 'it watches the CARD boxes, not the media');

  io.cb([{ target: near, isIntersecting: true }, { target: far, isIntersecting: true }]);
  assert.deepEqual(played.map(v => v.getAttribute('src')), ['/near.mp4'], 'one at a time');

  // Scrolled on: the far tile is now the centered one and takes over.
  near.getBoundingClientRect = rect(-90) as never;
  far.getBoundingClientRect = rect(340) as never;
  io.cb([{ target: near, isIntersecting: false }]);
  assert.deepEqual(played.map(v => v.getAttribute('src')), ['/near.mp4', '/far.mp4']);

  io.cb([{ target: far, isIntersecting: false }]);
  assert.equal(played.length, 2, 'nothing left visible, nothing new started');
  arm.destroy();
  assert.equal(io.disconnected, true);
});

test('a stale surface never starts a preview after it closed', () => {
  reset();
  hoverCapable = false;
  const card = tile(motionVideoThumb('/a.mp4', 'cat-thumb'));
  card.getBoundingClientRect = (() => ({ top: 300, height: 100, bottom: 400, left: 0, right: 0, width: 100, x: 0, y: 300, toJSON() {} })) as never;
  let live = true;
  const arm = armMotionPreviews(document.body, { isCurrent: () => live });
  live = false;
  observers[0]!.cb([{ target: card, isIntersecting: true }]);
  assert.equal(played.length, 0);
  arm.destroy();
});

test('an unmarked element is never touched, and a grid gap plays nothing', () => {
  reset();
  hoverCapable = true;
  tile('<img class="x" src="/still.svg">');
  const arm = armMotionPreviews(document.body);
  document.body.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.equal(played.length, 0);
  arm.destroy();
});
