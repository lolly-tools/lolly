// SPDX-License-Identifier: MPL-2.0
/**
 * Presentation-mode conductor (plan 112, M1) - DOM sanity tests under jsdom.
 *
 * Asserts the state-class CONTRACT (pr-active/pr-past/pr-future + pr-next, the hidden
 * window), navigation (keys + go()), the HUD counter, the debounced-URL callback surface,
 * `?s=` deep-link resolution, and - the plan's #1 risk - that the ORIGINAL frame pages are
 * never mutated (the presenter clones), so exit is byte-identical.
 *
 * Run directly:  node --test shells/web/src/views/present-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom realm BEFORE the module loads - present-mode.ts pulls in i18n/icons/a11y-prefs,
// which read browser globals; a dynamic import after this setup guarantees they exist.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;
// a11y.ts's announce() - which the P4 stage note goes through - schedules its live-region
// write on the bare global requestAnimationFrame. jsdom ships none; a next-tick stand-in is
// enough (nothing here asserts on the live region, only that the note path doesn't throw).
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof globalThis.requestAnimationFrame;
// jsdom has no matchMedia; a benign stub keeps prefersReducedMotion() → false (no reduce).
win.matchMedia = ((q: string) => ({
  matches: false, media: q, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent() { return false; },
})) as unknown as typeof win.matchMedia;
// jsdom's HTMLMediaElement.play/pause throw "Not implemented"; record play state instead so
// the conduct tests can read which slide's video is playing.
type Playable = HTMLVideoElement & { __playing?: boolean };
win.HTMLMediaElement.prototype.play = function (this: Playable) { this.__playing = true; return Promise.resolve(); };
win.HTMLMediaElement.prototype.pause = function (this: Playable) { this.__playing = false; };

const { openPresentMode } = await import('./present-mode.ts');
const { cameraFor, flightPath, FLIGHT_MARGIN } = await import('./present-math.ts');

/** Build a fresh source scope with N frame pages (ids slideK, laid out left→right). */
function makeSource(ids: string[]): HTMLElement {
  const src = document.createElement('div');
  src.id = 'tool-content';
  let x = 0;
  for (const id of ids) {
    const page = document.createElement('div');
    page.className = 'lolly-frame-page';
    page.setAttribute('data-pdf-page', '');
    page.setAttribute('data-frame-id', id);
    page.style.cssText = `position:absolute;left:${x}px;top:0px;width:1920px;height:1080px;background:#fff;overflow:hidden;`;
    page.textContent = id;
    src.appendChild(page);
    x += 2000;
  }
  document.body.appendChild(src);
  return src;
}

/** A source whose frames can carry a kiosk `dur` (ms), a `<video>` (optionally opted into
 *  present audio), and/or `data-build` fragment boxes. Pages sit under a `.lolly-frames`
 *  root, exactly as the tool's template renders them - that root is where the hook stamps
 *  `data-auto-advance`, the doc's consent to auto-advance (plan 179 T3). */
function makeRichSource(
  frames: Array<{
    id: string; dur?: number; video?: boolean; audio?: boolean; builds?: number[];
    state?: string; notes?: string;
    /** A narration clip on this slide (plans/180): its lead-in in ms, slide-local. */
    narration?: number;
    /** An audio box that did NOT opt into present audio - a bed, which must stay silent. */
    bed?: boolean;
    /** A burned-in caption box, by the class the caption preset stamps. */
    caption?: string;
  }>,
  opts: { autoAdvance?: boolean; presentCaptions?: boolean; narrationTailMs?: number } = {},
): HTMLElement {
  const src = document.createElement('div');
  src.id = 'tool-content';
  const root = document.createElement('div');
  root.className = 'lolly-frames';
  if (opts.autoAdvance) root.setAttribute('data-auto-advance', '1');
  if (opts.presentCaptions) root.setAttribute('data-present-captions', '1');
  if (opts.narrationTailMs != null) root.setAttribute('data-narration-tail', String(opts.narrationTailMs));
  src.appendChild(root);
  let x = 0;
  for (const f of frames) {
    const page = document.createElement('div');
    page.className = 'lolly-frame-page';
    page.setAttribute('data-pdf-page', '');
    page.setAttribute('data-frame-id', f.id);
    if (f.dur != null) page.setAttribute('data-frame-dur', String(f.dur));
    if (f.state != null) page.setAttribute('data-frame-state', f.state);
    if (f.notes != null) page.setAttribute('data-frame-notes', f.notes);
    page.style.cssText = `position:absolute;left:${x}px;top:0px;width:1920px;height:1080px;`;
    if (f.video) {
      const v = document.createElement('video');
      v.setAttribute('data-video-key', `vk-${f.id}`);
      if (f.audio) v.setAttribute('data-present-audio', '1');
      v.muted = true;
      page.appendChild(v);
    }
    for (const b of f.builds ?? []) {
      const box = document.createElement('div');
      box.className = 'lolly-box';
      box.setAttribute('data-box-id', `${f.id}-b${b}`);
      box.setAttribute('data-build', String(b));
      page.appendChild(box);
    }
    // A narration clip as the tool's hook renders one: a timed `.lolly-box` holding the
    // bare `[data-audio-src]` marker (there is no <audio> in the document), grouped as
    // this slide's narration. Its `data-t-start` IS the lead-in, in slide-local ms.
    if (f.narration != null) {
      const box = document.createElement('div');
      box.className = 'lolly-box';
      box.setAttribute('data-box-id', `${f.id}-narr`);
      box.setAttribute('data-t-start', String(f.narration));
      const marker = document.createElement('div');
      marker.className = 'lolly-box-audio';
      marker.setAttribute('data-audio-src', `blob:narration-${f.id}`);
      // On the MARKER, and as the flag, because that is where the tool's hook puts them
      // (community/design/hooks.js mediaHtmlFor). tests/design-present-narration.test.ts
      // drives the real hook output through this file so the two cannot drift.
      marker.setAttribute('data-narration', '1');
      marker.setAttribute('data-present-audio', '1');
      box.appendChild(marker);
      page.appendChild(box);
    }
    if (f.bed) {
      const box = document.createElement('div');
      box.className = 'lolly-box';
      box.setAttribute('data-box-id', `${f.id}-bed`);
      const marker = document.createElement('div');
      marker.setAttribute('data-audio-src', `blob:bed-${f.id}`);
      box.appendChild(marker);
      page.appendChild(box);
    }
    if (f.caption != null) {
      const box = document.createElement('div');
      box.className = 'lolly-box caption';
      box.setAttribute('data-box-id', `${f.id}-cap`);
      box.textContent = f.caption;
      page.appendChild(box);
    }
    root.appendChild(page);
    x += 2000;
  }
  document.body.appendChild(src);
  return src;
}

/** The clone's build boxes with a given `data-build` value. */
function buildBoxes(cloneIndex: number, value: number): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(
    `.pr-stage .pr-page[data-pr-index="${cloneIndex}"] [data-build="${value}"]`,
  )];
}
const shown = (els: HTMLElement[]) => els.every((e) => e.classList.contains('pr-shown'));

/** The <video> inside the clone at a given walk index (in the stage, not the source). */
function cloneVideo(i: number): Playable | null {
  return document.body.querySelector<Playable>(`.pr-stage .pr-page[data-pr-index="${i}"] video`);
}
/** The <audio> the presenter made for the clone's narration marker (plans/180 M-E). */
function cloneNarration(i: number): Playable | null {
  return document.body.querySelector<Playable>(
    `.pr-stage .pr-page[data-pr-index="${i}"] [data-narration-audio]`,
  );
}
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function stageEl(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.pr-stage');
}
function clones(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('.pr-stage .pr-page')];
}
function cleanup(): void {
  for (const s of document.body.querySelectorAll('.pr-stage')) s.remove();
  for (const s of document.body.querySelectorAll('#tool-content')) s.remove();
}

test('opens a stage of cloned pages; originals are NOT mutated', () => {
  const src = makeSource(['slide1', 'slide2', 'slide3']);
  const originalCss = [...src.querySelectorAll<HTMLElement>('.lolly-frame-page')].map((p) => p.style.cssText);
  const ctl = openPresentMode({ source: src });
  assert.ok(ctl, 'a controller is returned when frames exist');
  assert.ok(stageEl(), 'a .pr-stage is appended to the body');
  assert.equal(clones().length, 3, 'three page clones');
  // Originals: no presenter classes, no touched inline styles, still in the source.
  const origs = [...src.querySelectorAll<HTMLElement>('.lolly-frame-page')];
  assert.equal(origs.length, 3, 'originals still under the source');
  origs.forEach((p, i) => {
    assert.equal(p.style.cssText, originalCss[i], `original ${i} inline style untouched`);
    assert.ok(!p.className.includes('pr-'), `original ${i} carries no presenter class`);
    assert.equal(p.hasAttribute('hidden'), false, `original ${i} not hidden`);
  });
  ctl!.close();
  cleanup();
});

test('initial render: state-class contract + hidden window + HUD counter', () => {
  const src = makeSource(['slide1', 'slide2', 'slide3']);
  const addr: Array<{ id: string; i: number }> = [];
  const ctl = openPresentMode({ source: src, onAddress: (id, i) => addr.push({ id, i }) })!;
  const c = clones();
  // active = 0 → present; 1 → future+next (live); 2 → future, hidden (|2−0| > 1).
  assert.ok(c[0]!.classList.contains('pr-active'), 'slide1 active');
  assert.ok(c[1]!.classList.contains('pr-future'), 'slide2 future');
  assert.ok(c[1]!.classList.contains('pr-next'), 'slide2 is the next neighbour');
  assert.equal(c[1]!.hasAttribute('hidden'), false, 'the ±1 neighbour stays live');
  assert.ok(c[2]!.classList.contains('pr-future'), 'slide3 future');
  assert.equal(c[2]!.hasAttribute('hidden'), true, 'slide3 is beyond the live window → unloaded');
  // HUD counter.
  const counter = stageEl()!.querySelector('.pr-counter')!;
  assert.equal(counter.textContent, '1 / 3');
  // onAddress fired for the opening slide (reorder-proof id).
  assert.deepEqual(addr.at(-1), { id: 'slide1', i: 0 });
  assert.equal(ctl.frameId, 'slide1');
  ctl.close();
  cleanup();
});

test('ArrowRight advances; classes + counter + address follow', () => {
  const src = makeSource(['slide1', 'slide2', 'slide3']);
  const addr: string[] = [];
  const ctl = openPresentMode({ source: src, onAddress: (id) => addr.push(id) })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  const c = clones();
  assert.ok(c[1]!.classList.contains('pr-active'), 'slide2 now active');
  assert.ok(c[0]!.classList.contains('pr-past'), 'slide1 now past');
  assert.equal(stageEl()!.dataset.navDir, 'right', 'travel direction recorded on the root');
  assert.equal(stageEl()!.querySelector('.pr-counter')!.textContent, '2 / 3');
  assert.equal(ctl.frameId, 'slide2');
  assert.equal(addr.at(-1), 'slide2', 'address callback got the new frame id');
  // ArrowLeft goes back.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.ok(clones()[0]!.classList.contains('pr-active'), 'back to slide1');
  assert.equal(stageEl()!.dataset.navDir, 'left');
  ctl.close();
  cleanup();
});

test('does not advance past the end without loop; wraps with loop', () => {
  const src = makeSource(['a', 'b']);
  const noLoop = openPresentMode({ source: src })!;
  noLoop.go('2'); // to the last
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(noLoop.frameId, 'b', 'clamped at the end');
  noLoop.close(); cleanup();

  const src2 = makeSource(['a', 'b']);
  const looped = openPresentMode({ source: src2, loop: true })!;
  looped.go('2');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(looped.frameId, 'a', 'wraps to the first with loop');
  looped.close(); cleanup();
});

test('?s= deep-links: numeric position and frame id', () => {
  const byPos = openPresentMode({ source: makeSource(['x', 'y', 'z']), initial: '2' })!;
  assert.equal(byPos.frameId, 'y', 's=2 opens the second slide');
  byPos.close(); cleanup();

  const byId = openPresentMode({ source: makeSource(['x', 'y', 'z']), initial: 'z' })!;
  assert.equal(byId.frameId, 'z', 's=z opens that frame by id');
  byId.close(); cleanup();

  const junk = openPresentMode({ source: makeSource(['x', 'y']), initial: 'nope' })!;
  assert.equal(junk.frameId, 'x', 'an unresolvable address falls back to the first');
  junk.close(); cleanup();
});

test('overview toggles a class and reveals every page; O key + Escape peel it', () => {
  const src = makeSource(['a', 'b', 'c']);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'o' }));
  assert.ok(ctl.overview, 'O enters overview');
  assert.ok(stageEl()!.classList.contains('pr-overview'));
  // Every page is revealed in the map (none hidden).
  assert.ok(clones().every((c) => !c.hasAttribute('hidden')), 'no page unloaded in overview');
  // Escape peels overview back to the deck (not exit).
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(ctl.overview, false, 'Escape leaves overview first');
  assert.ok(stageEl(), 'still presenting after peeling overview');
  ctl.close(); cleanup();
});

test('close() removes the stage, restores page scroll, and fires onClose exactly once', () => {
  const src = makeSource(['a', 'b']);
  document.documentElement.style.overflow = ''; // resting state
  let closes = 0;
  const ctl = openPresentMode({ source: src, onClose: () => closes++ })!;
  assert.equal(document.documentElement.style.overflow, 'hidden', 'scroll locked while presenting');
  ctl.close();
  assert.equal(stageEl(), null, 'stage removed on close');
  assert.equal(document.documentElement.style.overflow, '', 'page scroll restored');
  assert.equal(ctl.frameId, null, 'controller reports closed');
  ctl.close(); // idempotent
  assert.equal(closes, 1, 'onClose fired exactly once');
  cleanup();
});

test('Escape exits the deck when not in overview and browser fullscreen is not held', () => {
  const src = makeSource(['a', 'b']);
  let closed = false;
  const ctl = openPresentMode({ source: src, onClose: () => { closed = true; } })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.ok(closed, 'Escape exits presentation from the deck');
  assert.equal(stageEl(), null);
  cleanup();
});

// ── M2: media conduct + kiosk ──────────────────────────────────────────────────────

test('media conduct: only the active slide’s video plays; navigation moves playback', () => {
  const src = makeRichSource([{ id: 'a', video: true }, { id: 'b', video: true }, { id: 'c', video: true }]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(cloneVideo(0)!.__playing, true, 'active slide video plays');
  assert.equal(cloneVideo(1)!.__playing, false, 'non-active video paused');
  assert.equal(cloneVideo(2)!.__playing, false, 'non-active video paused');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(cloneVideo(0)!.__playing, false, 'left slide pauses (currentTime preserved → resume on return)');
  assert.equal(cloneVideo(1)!.__playing, true, 'new active plays');
  ctl.close(); cleanup();
});

test('kiosk: a frame with dur auto-advances; the pause button + progress bar appear', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b' }], { autoAdvance: true });
  const ctl = openPresentMode({ source: src })!;
  // Deck has a dwell → pause button + progress bar exist and the bar is armed on slide 1.
  assert.ok(stageEl()!.querySelector('.pr-progress'), 'progress bar present when the deck has durs');
  assert.equal(ctl.frameId, 'a');
  await delay(80);
  assert.equal(ctl.frameId, 'b', 'auto-advanced after the dwell');
  // frame b has no dur and is the last → it stops there (no runaway).
  await delay(60);
  assert.equal(ctl.frameId, 'b', 'stays on the last, un-dwelled slide');
  ctl.close(); cleanup();
});

test('kiosk: k pauses auto-advance (stoppable); it does not advance while paused', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b', dur: 25 }, { id: 'c' }], { autoAdvance: true });
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k' }));
  assert.ok(!stageEl()!.querySelector('.pr-progress')!.classList.contains('pr-progress-on'), 'progress off while paused');
  await delay(80);
  assert.equal(ctl.frameId, 'a', 'did not advance while paused');
  ctl.close(); cleanup();
});

// T3 (plan 179): `dur` is a frame's TIMELINE length; "Place in order" writes one on every
// frame, and the hook stamps it as data-frame-dur. Auto-advance has to be asked for, or a
// click-advanced deck silently becomes a kiosk deck the moment it touches the timeline.
test('kiosk: data-frame-dur alone does NOT arm auto-advance (no dwell, no bar, no pause)', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b', dur: 25 }, { id: 'c' }]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(stageEl()!.querySelector('.pr-progress'), null, 'no progress bar without consent');
  assert.equal(stageEl()!.querySelector('.pr-hud-btn[aria-label="Pause"]'), null, 'no pause button either');
  await delay(90);
  assert.equal(ctl.frameId, 'a', 'stayed put - the deck is click-advanced');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'b', 'clicking still advances it');
  ctl.close(); cleanup();
});

test('kiosk: data-auto-advance on the doc root arms the dwell', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b' }], { autoAdvance: true });
  const ctl = openPresentMode({ source: src })!;
  assert.ok(stageEl()!.querySelector('.pr-progress'), 'progress bar back once the doc asks');
  await delay(90);
  assert.equal(ctl.frameId, 'b', 'auto-advanced');
  ctl.close(); cleanup();
});

test('kiosk: the ?kiosk signage flag arms the dwell without data-auto-advance', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src, loop: true })!;
  assert.ok(stageEl()!.querySelector('.pr-progress'), 'signage links keep their dwell');
  await delay(90);
  assert.equal(ctl.frameId, 'b', 'kiosk link auto-advances');
  ctl.close(); cleanup();
});

test('kiosk: data-auto-advance="0" is not consent', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b' }]);
  src.querySelector('.lolly-frames')!.setAttribute('data-auto-advance', '0');
  const ctl = openPresentMode({ source: src })!;
  assert.equal(stageEl()!.querySelector('.pr-progress'), null, 'an off switch reads as off');
  await delay(90);
  assert.equal(ctl.frameId, 'a', 'no dwell');
  ctl.close(); cleanup();
});

test('blackout: b blacks the deck and pauses media; any key resumes without navigating', () => {
  const src = makeRichSource([{ id: 'a', video: true }, { id: 'b', video: true }]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(cloneVideo(0)!.__playing, true);
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'b' }));
  assert.ok(stageEl()!.classList.contains('pr-blackout'), 'deck goes black');
  assert.equal(cloneVideo(0)!.__playing, false, 'media pauses under blackout');
  // Any key lifts blackout and is spent doing so - it must NOT also advance.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(stageEl()!.classList.contains('pr-blackout'), false, 'resumed from black');
  assert.equal(ctl.frameId, 'a', 'the resume keystroke did not advance the deck');
  assert.equal(cloneVideo(0)!.__playing, true, 'active media resumes');
  ctl.close(); cleanup();
});

// ── M3: builds (fragments) ───────────────────────────────────────────────────────────

test('builds: fragments start hidden; advance reveals them step-by-step (equal values together)', () => {
  const src = makeRichSource([{ id: 'a', builds: [1, 2, 2, 3] }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  // build 0 → nothing revealed.
  assert.ok(!shown(buildBoxes(0, 1)), 'build 1 hidden at start');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(shown(buildBoxes(0, 1)), 'build 1 revealed');
  assert.ok(!shown(buildBoxes(0, 2)), 'build 2 still hidden');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(shown(buildBoxes(0, 2)), 'both build-2 boxes reveal together');
  assert.ok(!shown(buildBoxes(0, 3)), 'build 3 still hidden');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(shown(buildBoxes(0, 3)), 'build 3 revealed');
  assert.equal(ctl.frameId, 'a', 'still on slide a while its builds run');
  // builds exhausted → next advances the slide.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'b', 'exhausted builds → next slide');
  ctl.close(); cleanup();
});

test('builds: prev steps back through builds, then backward arrival shows all builds', () => {
  const src = makeRichSource([{ id: 'a', builds: [1, 2] }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  // advance through a's builds and onto b.
  for (let i = 0; i < 3; i++) document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'b');
  // prev: back to a, arriving with ALL its builds shown.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(ctl.frameId, 'a');
  assert.ok(shown(buildBoxes(0, 1)) && shown(buildBoxes(0, 2)), 'backward arrival reveals every build');
  // prev again steps the builds back down.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.ok(shown(buildBoxes(0, 1)) && !shown(buildBoxes(0, 2)), 'stepped build 2 back off');
  ctl.close(); cleanup();
});

test('builds: s=h.f deep-links to a build threshold; onAddress emits id.build', () => {
  const addr: Array<[string, number, number]> = [];
  const src = makeRichSource([{ id: 'a', builds: [1, 2, 3] }]);
  const ctl = openPresentMode({ source: src, initial: 'a.2', onAddress: (id, i, b) => addr.push([id, i, b]) })!;
  assert.equal(ctl.frameId, 'a');
  assert.ok(shown(buildBoxes(0, 1)) && shown(buildBoxes(0, 2)), 's=a.2 reveals builds 1–2');
  assert.ok(!shown(buildBoxes(0, 3)), 'build 3 stays hidden at threshold 2');
  assert.deepEqual(addr.at(-1), ['a', 0, 2], 'onAddress carries the build threshold');
  // advancing a build emits id.3.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.deepEqual(addr.at(-1), ['a', 0, 3]);
  ctl.close(); cleanup();
});

test('audio: only a box opted into present audio unmutes on its active slide', () => {
  const src = makeRichSource([
    { id: 'a', video: true, audio: true },   // opted in
    { id: 'b', video: true },                // not opted in
  ]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(cloneVideo(0)!.muted, false, 'opted-in active box plays with sound');
  assert.equal(cloneVideo(1)!.muted, true, 'non-active box stays muted');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(cloneVideo(0)!.muted, true, 'left slide re-mutes');
  assert.equal(cloneVideo(1)!.muted, true, 'the un-opted active box stays muted (no blare)');
  ctl.close(); cleanup();
});

// ── narration conduct + the T9 advance (plans/180 M-E) ─────────────────────────

test('narration: the active slide speaks after its lead-in, and leaving it pauses the voice', async () => {
  // A Design audio box renders as a bare `[data-audio-src]` marker - there is no <audio>
  // in the document at all - so the presenter has to make one. The lead-in is the clip's
  // own slide-local start (T2: the first word waits for the slide to arrive).
  const src = makeRichSource([{ id: 'a', narration: 40 }, { id: 'b', narration: 0 }]);
  const ctl = openPresentMode({ source: src })!;
  assert.ok(cloneNarration(0), 'the marker got a player');
  assert.notEqual(cloneNarration(0)!.__playing, true, 'and it is silent through the lead-in');
  await delay(80);
  assert.equal(cloneNarration(0)!.__playing, true, 'then it speaks');
  assert.equal(cloneNarration(1), null, 'a slide nobody is looking at is not even given a player');

  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(cloneNarration(0)!.__playing, false, 'the slide left goes quiet');
  assert.equal(cloneNarration(1)!.__playing, true, 'and the arriving slide speaks at once (no lead-in)');
  ctl.close(); cleanup();
});

test('narration: audio that did not opt in stays silent, and close takes the voice off the air', async () => {
  // The video rule, applied to sound with no picture: a bed is on a slide for the FILM,
  // and playing it at the podium would blare over the person speaking.
  const src = makeRichSource([{ id: 'a', narration: 0, bed: true }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const bed = document.body.querySelector<HTMLElement>('.pr-stage [data-audio-src^="blob:bed"]')!;
  assert.equal(bed.querySelector('[data-narration-audio]'), null, 'the bed was never given a player');
  const voice = cloneNarration(0)!;
  assert.equal(voice.__playing, true);
  ctl.close();
  assert.equal(voice.__playing, false, 'closing the deck stops the voice, before the stage is dropped');
  cleanup();
});

test('kiosk: a narrated slide advances when the WORDS end, not when the dwell timer does', async () => {
  // T9. The dwell solver sizes a slide to hold its narration, so the two normally end
  // together - but a clip that starts late or runs long must not be cut off mid-sentence
  // by a timer that never listened to it.
  const src = makeRichSource(
    [{ id: 'a', dur: 25, narration: 0 }, { id: 'b' }],
    { autoAdvance: true, narrationTailMs: 30 },
  );
  const ctl = openPresentMode({ source: src })!;
  const voice = cloneNarration(0)!;
  assert.equal(voice.__playing, true);
  await delay(80);
  assert.equal(ctl.frameId, 'a', 'the dwell ran out while the slide was still speaking');

  voice.dispatchEvent(new win.Event('ended'));
  assert.equal(ctl.frameId, 'a', 'the tail is still owed after the last word');
  await delay(70);
  assert.equal(ctl.frameId, 'b', 'and then the deck moves on');
  ctl.close(); cleanup();
});

test('narration: a finished clip speaks again on the next lap, but not after a blackout', async () => {
  // A signage deck loops, so "already said" cannot mean "never again". A blackout is not
  // a lap though: the presenter is still standing on the same slide, and re-speaking the
  // words on the way back would be the deck talking over them.
  const src = makeRichSource([{ id: 'a', narration: 0 }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src, loop: true })!;
  const voice = cloneNarration(0)!;
  assert.equal(voice.__playing, true);
  voice.dispatchEvent(new win.Event('ended'));
  voice.__playing = false;

  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'b' }));  // blackout
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'b' }));  // and back
  assert.notEqual(voice.__playing, true, 'the slide it never left does not start over');

  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));  // wraps to a
  assert.equal(ctl.frameId, 'a', 'round again');
  assert.equal(voice.__playing, true, 'and the deck says its piece a second time');
  ctl.close(); cleanup();
});

test('kiosk: a slide with no narration still advances on its dwell alone', async () => {
  const src = makeRichSource([{ id: 'a', dur: 25 }, { id: 'b' }], { autoAdvance: true });
  const ctl = openPresentMode({ source: src })!;
  await delay(80);
  assert.equal(ctl.frameId, 'b', 'nothing to wait for, so nothing waits');
  ctl.close(); cleanup();
});

test('captions: burned-in caption boxes are hidden at the podium unless the document asks', () => {
  // A caption is for a FILE - the same words are being said out loud in this room. Hidden
  // on the CLONE only: the canvas, the export and the video keep every caption as authored.
  const src = makeRichSource([{ id: 'a', caption: 'the words' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const cap = document.body.querySelector<HTMLElement>('.pr-stage .caption')!;
  assert.equal(cap.hidden, true);
  assert.equal(src.querySelector<HTMLElement>('.caption')!.hidden, false, 'the original is untouched');
  ctl.close(); cleanup();

  const asked = makeRichSource([{ id: 'a', caption: 'the words' }], { presentCaptions: true });
  const ctl2 = openPresentMode({ source: asked })!;
  assert.equal(document.body.querySelector<HTMLElement>('.pr-stage .caption')!.hidden, false,
    'the document asked for them, so they stay up');
  ctl2.close(); cleanup();
});

test('captions: a slide that narrates ITSELF keeps them - the podium is the speaker', () => {
  // The reason captions are hidden at a podium is that a person in the room is saying the
  // same words. On a narrated slide nobody is: the synthesized voice is the only carrier
  // of the content, and hiding the cues cut from its own word timings leaves a deaf
  // attendee with nothing at all.
  const src = makeRichSource([
    { id: 'a', narration: 0, caption: 'the words' },
    { id: 'b', caption: 'not narrated' },
  ]);
  const ctl = openPresentMode({ source: src })!;
  const capOn = (i: number): boolean =>
    !!document.body.querySelector<HTMLElement>(`.pr-stage .pr-page[data-pr-index="${i}"] .caption`)?.hidden;
  assert.equal(capOn(0), false, 'the narrated slide keeps its captions');
  assert.equal(capOn(1), true, 'a slide with a live speaker still hides them');
  ctl.close(); cleanup();
});

// ── the audio controls a self-playing deck owes its audience (WCAG 1.4.2) ──────

test('narration: a narrated deck offers pause and mute even with auto-advance off', async () => {
  // Auto-advance defaults to OFF, and the pause button used to be offered only for a
  // kiosk dwell - so a narrated deck spoke for minutes with nothing on the HUD to stop it.
  const src = makeRichSource([{ id: 'a', narration: 0 }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const hud = document.body.querySelector<HTMLElement>('.pr-stage .pr-hud')!;
  const labels = [...hud.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
  assert.ok(labels.includes('Pause'), `a narrated deck can be held: ${labels.join(', ')}`);
  assert.ok(labels.includes('Mute narration'), `and silenced: ${labels.join(', ')}`);

  const voice = cloneNarration(0)!;
  assert.equal(voice.__playing, true);
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k' }));
  assert.equal(voice.__playing, false, 'pause stops the VOICE, not only the dwell timer');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k' }));
  assert.equal(voice.__playing, true, 'and resume puts it back on the air');
  ctl.close(); cleanup();
});

test('narration: mute silences the voice without stopping its clock', () => {
  const src = makeRichSource([{ id: 'a', narration: 0 }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const voice = cloneNarration(0)!;
  assert.equal(voice.muted, false);
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm' }));
  assert.equal(voice.muted, true);
  assert.equal(voice.__playing, true, 'silenced, not stopped - `ended` still moves a kiosk deck on');
  const mute = [...document.body.querySelectorAll<HTMLElement>('.pr-stage .pr-hud button')]
    .find((b) => b.getAttribute('aria-label') === 'Unmute narration');
  assert.ok(mute, 'the button says what pressing it will now do');
  assert.equal(mute!.getAttribute('aria-pressed'), 'true');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm' }));
  assert.equal(voice.muted, false);
  ctl.close(); cleanup();
});

test('a deck with no sound of its own grows neither control', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const labels = [...document.body.querySelectorAll<HTMLElement>('.pr-stage .pr-hud button')]
    .map((b) => b.getAttribute('aria-label'));
  assert.ok(!labels.includes('Mute narration'), 'nothing to mute');
  assert.ok(!labels.includes('Pause'), 'and nothing to hold');
  ctl.close(); cleanup();
});

test('frame state: the active frame lifts its tokens onto the stage root; they follow the slide', () => {
  const src = makeRichSource([
    { id: 'a', state: 'dark title' },
    { id: 'b' },
    { id: 'c', state: 'accent' },
  ]);
  const ctl = openPresentMode({ source: src })!;
  const stage = stageEl()!;
  assert.ok(stage.classList.contains('dark') && stage.classList.contains('title'), 'slide a state on the root');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(!stage.classList.contains('dark') && !stage.classList.contains('title'), 'slide a tokens removed on leave');
  assert.ok(!stage.classList.contains('accent'), 'slide b has no state');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(stage.classList.contains('accent'), 'slide c state applied');
  ctl.close(); cleanup();
});

test('morph transition: advances the slide and applies pr-morphing (jsdom has no layout/animation)', () => {
  const src = document.createElement('div');
  src.id = 'tool-content';
  for (const id of ['a', 'b']) {
    const page = document.createElement('div');
    page.className = 'lolly-frame-page';
    page.setAttribute('data-pdf-page', '');
    page.setAttribute('data-frame-id', id);
    page.style.cssText = 'position:absolute;left:0px;top:0px;width:1920px;height:1080px;';
    const box = document.createElement('div');
    box.className = 'lolly-box';
    box.setAttribute('data-box-id', `${id}-t`);
    const txt = document.createElement('div');
    txt.className = 'lolly-box-text';
    txt.textContent = 'Shared'; // identical text → the two boxes morph-match
    box.appendChild(txt);
    page.appendChild(box);
    src.appendChild(page);
  }
  document.body.appendChild(src);
  const ctl = openPresentMode({ source: src, transition: 'morph' })!;
  assert.equal(stageEl()!.dataset.prTransition, 'morph');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'b', 'morph advanced the slide');
  assert.ok(stageEl()!.classList.contains('pr-morphing'), 'pr-morphing applied for the crossfade');
  ctl.close(); cleanup();
});

test('returns null (no stage) when the document has no frames', () => {
  const src = document.createElement('div');
  document.body.appendChild(src);
  const ctl = openPresentMode({ source: src });
  assert.equal(ctl, null, 'nothing to present → no controller');
  assert.equal(stageEl(), null, 'and no stage is created');
  cleanup();
});

// ---- Speaker view (M5) --------------------------------------------------------------
const speakerEl = () => document.body.querySelector<HTMLElement>('.pr-stage .pr-speaker');

test('speaker view: `S` toggles the panel; it shows current + next previews and the counter', () => {
  const src = makeRichSource([{ id: 'a', notes: 'open strong' }, { id: 'b' }, { id: 'c' }]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(speakerEl(), null, 'no panel until opened');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  const sp = speakerEl();
  assert.ok(sp, 'S opens the speaker panel');
  // Two slide previews: the current (a) and the next (b), each a scaled page clone.
  const previews = sp!.querySelectorAll('.pr-preview .lolly-frame-page');
  assert.equal(previews.length, 2, 'current + next previews mounted');
  assert.equal(sp!.querySelector('.pr-sp-counter')!.textContent, '1 / 3', 'counter reads current/total');
  // A preview page is static: it dropped the deck placement/state classes.
  const anyPreview = sp!.querySelector<HTMLElement>('.pr-preview .lolly-frame-page')!;
  assert.ok(!anyPreview.classList.contains('pr-page'), 'preview clone is not a live deck page');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  assert.equal(speakerEl(), null, 'S again closes the panel');
  ctl.close(); cleanup();
});

// The controller's own door onto the same verb (plan 179 M1): the Design top bar's
// "Speaker view" row opens the presenter and then asks for the notes panel, so the caller
// needs a method - it cannot synthesise a keystroke into a stage it has only just created.
test('speaker view: controller.speaker() is the same toggle the `S` key spends', () => {
  const src = makeRichSource([{ id: 'a', notes: 'open strong' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  assert.equal(speakerEl(), null, 'no panel until asked for');
  ctl.speaker();
  assert.ok(speakerEl(), 'speaker() opens the panel');
  // The SAME state, not a parallel one: the key must be able to close what the method opened.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  assert.equal(speakerEl(), null, '`S` closes the panel speaker() opened');
  ctl.speaker();
  assert.ok(speakerEl(), 'and speaker() opens it again');
  ctl.speaker();
  assert.equal(speakerEl(), null, 'a second speaker() closes it - it is a toggle, not a one-way door');
  ctl.close(); cleanup();
});

test('speaker view: speaker() on a CLOSED presenter is inert (no stage to grow a panel on)', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  ctl.close();
  assert.doesNotThrow(() => ctl.speaker());
  assert.equal(document.body.querySelector('.pr-speaker'), null, 'nothing was built');
  cleanup();
});

test('speaker view: shows the ACTIVE frame notes; empty when the frame has none', () => {
  const src = makeRichSource([{ id: 'a', notes: 'say the thing' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  const notes = () => speakerEl()!.querySelector<HTMLElement>('.pr-sp-notes')!;
  assert.equal(notes().textContent, 'say the thing', 'slide a notes shown');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(notes().textContent, '', 'slide b has no notes → cleared');
  assert.equal(notes().style.display, 'none', 'empty notes are hidden');
  ctl.close(); cleanup();
});

test('speaker view: the last slide has no next preview', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End' }));   // → last slide
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  const sp = speakerEl()!;
  assert.equal(sp.querySelector('.pr-sp-slot-next')!.children.length, 0, 'no next preview on the final slide');
  assert.equal(sp.querySelector<HTMLElement>('.pr-sp-nextwrap')!.style.visibility, 'hidden', 'next label hidden');
  ctl.close(); cleanup();
});

test('speaker view: opening the overview closes the speaker panel (mutually exclusive)', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  assert.ok(speakerEl(), 'speaker open');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'o' }));
  assert.equal(speakerEl(), null, 'overview closed the speaker panel');
  assert.ok(stageEl()!.classList.contains('pr-overview'), 'overview is on');
  ctl.close(); cleanup();
});

test('speaker view: closing the presenter does not leak a running timer or panel', () => {
  const src = makeRichSource([{ id: 'a', notes: 'x' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
  assert.ok(speakerEl(), 'speaker open');
  ctl.close();
  assert.equal(document.body.querySelector('.pr-stage'), null, 'stage (and its speaker panel) gone');
  cleanup();
});

test('speaker view: opens a SECOND WINDOW when window.open succeeds (deck stays uncovered)', () => {
  const src = makeRichSource([{ id: 'a', notes: 'hello there' }, { id: 'b' }]);
  // A same-realm stand-in popup: createHTMLDocument shares this JSDOM realm, so importNode
  // (cross-document, same realm) works and the real window branch runs.
  const popupDoc = document.implementation.createHTMLDocument('spk');
  const fakeWin = {
    document: popupDoc, closed: false, innerWidth: 1100, innerHeight: 760,
    focus() {}, close() { (this as { closed: boolean }).closed = true; },
    addEventListener() {}, removeEventListener() {},
  } as unknown as Window;
  const realOpen = win.open;
  win.open = (() => fakeWin) as typeof win.open;
  try {
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    // The panel lives in the POPUP; the main stage is NOT covered by an overlay.
    assert.equal(document.body.querySelector('.pr-stage .pr-speaker'), null, 'main deck not covered in window mode');
    const sp = popupDoc.querySelector('.pr-speaker');
    assert.ok(sp, 'panel built in the second window');
    // The window title survives the head-clear (set AFTER replaceChildren, not before).
    assert.equal(popupDoc.title, 'Speaker view', 'popup window is titled');
    assert.equal(sp!.querySelectorAll('.pr-preview .lolly-frame-page').length, 2, 'current + next previews in the popup');
    assert.equal(sp!.querySelector('.pr-sp-notes')!.textContent, 'hello there', 'notes rendered in the popup');
    // Advancing from the MAIN window repaints the popup.
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(popupDoc.querySelector('.pr-sp-counter')!.textContent, '2 / 2', 'popup counter tracks the deck');
    // Closing the presenter closes the popup.
    ctl.close();
    assert.equal(fakeWin.closed, true, 'second window closed on exit');
  } finally {
    win.open = realOpen;
    cleanup();
  }
});

test('speaker view: a popup closed from its own titlebar is reaped (button resets)', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const popupDoc = document.implementation.createHTMLDocument('spk');
  const fakeWin = {
    document: popupDoc, closed: false, innerWidth: 1100, innerHeight: 760,
    focus() {}, close() { (this as { closed: boolean }).closed = true; },
    addEventListener() {}, removeEventListener() {},
  } as unknown as Window;
  const realOpen = win.open;
  win.open = (() => fakeWin) as typeof win.open;
  try {
    const ctl = openPresentMode({ source: src })!;
    const btn = stageEl()!.querySelector<HTMLElement>('.pr-hud-btn[aria-label="Speaker view"]')!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    assert.equal(btn.getAttribute('aria-pressed'), 'true', 'button reflects the open window');
    // The user closes the popup from its titlebar; the next toggle sees a dead handle and
    // tears the state down cleanly (the 500ms heartbeat would do the same unattended).
    (fakeWin as unknown as { closed: boolean }).closed = true;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));  // toggle → closeSpeaker → reset
    assert.equal(btn.getAttribute('aria-pressed'), 'false', 'button reset after the window died');
    ctl.close();
  } finally {
    win.open = realOpen;
    cleanup();
  }
});

// ---- P4: the speaker view always says where it went ---------------------------------
// The defect: `s` called window.open, the popup was blocked, and the tab showed nothing at
// all. The popup stays the preferred path; a blocked or vanished one falls back in place
// and says so.
const noteText = () => stageEl()?.querySelector<HTMLElement>('.pr-note')?.textContent ?? '';

/** A same-realm stand-in popup (createHTMLDocument shares this JSDOM realm, so importNode
 *  works and the real window branch runs). */
function fakePopup(): Window & { closed: boolean } {
  const popupDoc = document.implementation.createHTMLDocument('spk');
  return {
    document: popupDoc, closed: false, innerWidth: 1100, innerHeight: 760,
    focus() {}, close() { (this as { closed: boolean }).closed = true; },
    addEventListener() {}, removeEventListener() {},
  } as unknown as Window & { closed: boolean };
}

test('speaker view: a blocked popup falls back to the in-page panel and says so', () => {
  const src = makeRichSource([{ id: 'a', notes: 'hi' }, { id: 'b' }]);
  const realOpen = win.open;
  win.open = (() => null) as unknown as typeof win.open;   // the blocker's answer
  try {
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    assert.ok(speakerEl(), 'the panel opened here instead of nowhere');
    assert.equal(noteText(), 'Popup blocked. Showing the speaker view here.', 'and the presenter is told why');
    assert.ok(stageEl()!.classList.contains('pr-speaker-on'), 'stage marked for the in-page layout');
    ctl.close();
  } finally { win.open = realOpen; cleanup(); }
});

test('speaker view: a popup that opens announces where it went', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const fakeWin = fakePopup();
  const realOpen = win.open;
  win.open = (() => fakeWin) as typeof win.open;
  try {
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    assert.equal(noteText(), 'Speaker view opened in a new window.', 'the tab says where to look');
    assert.equal(speakerEl(), null, 'the panel really is in the popup, not here');
    ctl.close();
  } finally { win.open = realOpen; cleanup(); }
});

test('speaker view: a popup that vanishes within the probe window falls back in place', async () => {
  const src = makeRichSource([{ id: 'a', notes: 'hi' }, { id: 'b' }]);
  const fakeWin = fakePopup();
  const realOpen = win.open;
  win.open = (() => fakeWin) as typeof win.open;
  try {
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    assert.equal(speakerEl(), null, 'window path taken first');
    fakeWin.closed = true;                       // the blocker closes it a tick later
    await delay(650);                            // past the 500ms probe
    assert.ok(speakerEl(), 'the probe noticed and opened the in-page panel');
    assert.equal(noteText(), 'Popup blocked. Showing the speaker view here.');
    ctl.close();
  } finally { win.open = realOpen; cleanup(); }
});

// ---- T7: the presenter paints the editor's colours -----------------------------------
// The clones are the canvas's own markup, so a box coloured `var(--brand-on-primary,#fff)`
// resolves against whoever hosts it - and the stage is a body-level overlay outside the
// canvas element applyBrandVars writes those slots onto.
test('brand vars: the stage carries the canvas custom properties (fallbacks never win)', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const canvas = document.createElement('div');
  canvas.id = 'tool-canvas';
  canvas.style.setProperty('--brand-on-primary', '#0c322d');
  canvas.style.setProperty('--brand-primary', '#30ba78');
  canvas.style.setProperty('--font-brand', "'SUSE', sans-serif");
  canvas.style.setProperty('--not-a-brand-var', 'nope');
  document.body.appendChild(canvas);
  try {
    const ctl = openPresentMode({ source: src, varsFrom: canvas })!;
    const stage = stageEl()!;
    assert.equal(stage.style.getPropertyValue('--brand-on-primary'), '#0c322d', 'the dark ink comes across');
    assert.equal(stage.style.getPropertyValue('--brand-primary'), '#30ba78');
    assert.equal(stage.style.getPropertyValue('--font-brand'), "'SUSE', sans-serif");
    assert.equal(stage.style.getPropertyValue('--not-a-brand-var'), '', 'only the three namespaces travel');
    ctl.close();
  } finally { canvas.remove(); cleanup(); }
});

test('brand vars: <html>-level properties travel too, and the canvas wins a clash', () => {
  const src = makeRichSource([{ id: 'a' }]);
  const canvas = document.createElement('div');
  canvas.id = 'tool-canvas';
  canvas.style.setProperty('--brand-primary', '#30ba78');
  document.body.appendChild(canvas);
  document.documentElement.style.setProperty('--font-brand', "'Outfit', sans-serif");
  document.documentElement.style.setProperty('--brand-primary', '#ff0000');
  try {
    const ctl = openPresentMode({ source: src, varsFrom: canvas })!;
    const stage = stageEl()!;
    assert.equal(stage.style.getPropertyValue('--font-brand'), "'Outfit', sans-serif", 'inherited from <html>');
    assert.equal(stage.style.getPropertyValue('--brand-primary'), '#30ba78', 'nearest scope wins, as the cascade would');
    ctl.close();
  } finally {
    document.documentElement.style.removeProperty('--font-brand');
    document.documentElement.style.removeProperty('--brand-primary');
    canvas.remove(); cleanup();
  }
});

test('brand vars: the speaker popup document gets them too (it hosts its own clones)', () => {
  const src = makeRichSource([{ id: 'a' }, { id: 'b' }]);
  const canvas = document.createElement('div');
  canvas.id = 'tool-canvas';
  canvas.style.setProperty('--brand-on-primary', '#0c322d');
  document.body.appendChild(canvas);
  const fakeWin = fakePopup();
  const realOpen = win.open;
  win.open = (() => fakeWin) as typeof win.open;
  try {
    const ctl = openPresentMode({ source: src, varsFrom: canvas })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's' }));
    assert.equal(
      fakeWin.document.documentElement.style.getPropertyValue('--brand-on-primary'), '#0c322d',
      'the second window paints the same colours',
    );
    ctl.close();
  } finally { win.open = realOpen; canvas.remove(); cleanup(); }
});

// ── M4: the per-slide motion clock, and the flight transition ───────────────────────
// A slide's boxes carry the timeline's own enter/exit attributes; an UNTIMED box carries
// a presenter-only pair under `data-pr-*` (widening `data-t-enter` to every box would
// change what the video compositor renders). The presenter copies those onto its own
// CLONE and runs them off a clock that starts when the slide arrives.

/** A source whose boxes can carry motion, and whose frames can name a transition. */
function makeMotionSource(
  frames: Array<{
    id: string;
    transition?: string;
    /** The page's own place on the document timeline, ms. */
    start?: number;
    boxes?: Array<{
      id?: string; build?: number; prEnter?: string; prEnterMs?: number;
      prExit?: string; prExitMs?: number;
      start?: number; dur?: number;
    }>;
  }>,
): HTMLElement {
  const src = document.createElement('div');
  src.id = 'tool-content';
  const root = document.createElement('div');
  root.className = 'lolly-frames';
  src.appendChild(root);
  let x = 0;
  for (const f of frames) {
    const page = document.createElement('div');
    page.className = 'lolly-frame-page';
    page.setAttribute('data-pdf-page', '');
    page.setAttribute('data-frame-id', f.id);
    if (f.transition != null) page.setAttribute('data-frame-transition', f.transition);
    if (f.start != null) page.setAttribute('data-t-start', String(f.start));
    page.style.cssText = `position:absolute;left:${x}px;top:0px;width:1920px;height:1080px;`;
    for (const [i, b] of (f.boxes ?? []).entries()) {
      const box = document.createElement('div');
      box.className = 'lolly-box';
      box.setAttribute('data-box-id', b.id ?? `${f.id}-${i}`);
      box.style.cssText = 'position:absolute;left:0px;top:0px;width:400px;height:200px;';
      if (b.build != null) box.setAttribute('data-build', String(b.build));
      if (b.prEnter) {
        box.setAttribute('data-pr-enter', b.prEnter);
        box.setAttribute('data-pr-enter-ms', String(b.prEnterMs ?? 400));
      }
      if (b.prExit) {
        box.setAttribute('data-pr-exit', b.prExit);
        box.setAttribute('data-pr-exit-ms', String(b.prExitMs ?? 400));
      }
      if (b.start != null) box.setAttribute('data-t-start', String(b.start));
      if (b.dur != null) box.setAttribute('data-t-dur', String(b.dur));
      page.appendChild(box);
    }
    root.appendChild(page);
    x += 2000;
  }
  document.body.appendChild(src);
  return src;
}

/** One box inside the CLONE at a walk index. */
function cloneBox(i: number, id: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(
    `.pr-stage .pr-page[data-pr-index="${i}"] [data-box-id="${id}"]`,
  );
}

test('motion: the CLONE is re-stamped into slide-local time; the original is untouched', () => {
  const src = makeMotionSource([
    { id: 'a', start: 5000, boxes: [{ id: 'plain', prEnter: 'fade', prEnterMs: 300 }, { id: 'timed', start: 5600, dur: 900 }] },
    { id: 'b' },
  ]);
  const ctl = openPresentMode({ source: src })!;
  const plain = cloneBox(0, 'plain')!;
  assert.equal(plain.getAttribute('data-t-enter'), 'fade', 'the presenter-only Enter became the applier’s own');
  assert.equal(plain.getAttribute('data-t-enter-ms'), '300', 'with its length');
  assert.equal(plain.getAttribute('data-t-start'), '0', 'it arrives with the slide');
  // A timed box is rebased off its FRAME's start: 5600 on the document timeline is
  // 600ms into this slide.
  assert.equal(cloneBox(0, 'timed')!.getAttribute('data-t-start'), '600');
  assert.equal(cloneBox(0, 'timed')!.getAttribute('data-t-dur'), '900', 'its length is its own');
  // The page itself is a slide now, not a clip in a longer film.
  assert.equal(document.body.querySelector('.pr-stage .pr-page[data-pr-index="0"]')!.hasAttribute('data-t-start'), false);
  // The ORIGINAL page and boxes never saw any of it.
  const origBox = src.querySelector<HTMLElement>('[data-box-id="plain"]')!;
  assert.equal(origBox.hasAttribute('data-t-enter'), false, 'the editor’s DOM keeps its own attributes');
  assert.equal(origBox.hasAttribute('data-t-start'), false);
  assert.equal(src.querySelector<HTMLElement>('.lolly-frame-page')!.getAttribute('data-t-start'), '5000');
  ctl.close(); cleanup();
});

test('motion: a build box is held off the slide until next() reveals it at the clock', () => {
  const src = makeMotionSource([
    { id: 'a', boxes: [{ id: 'frag', build: 1, prEnter: 'fade' }, { id: 'always', prEnter: 'fade' }] },
    { id: 'b' },
  ]);
  const ctl = openPresentMode({ source: src })!;
  assert.ok(stageEl()!.classList.contains('pr-motion'), 'the stage says a slide is on the clock');
  const frag = cloneBox(0, 'frag')!;
  assert.ok(frag.classList.contains('seq-off'), 'the fragment is off the slide at arrival');
  assert.ok(!cloneBox(0, 'always')!.classList.contains('seq-off'), 'a box that arrives with the slide is on it');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'a', 'the advance was spent on the fragment, not the slide');
  assert.ok(!frag.classList.contains('seq-off'), 'the fragment is on the slide now');
  const at = Number(frag.getAttribute('data-t-start'));
  assert.ok(Number.isFinite(at) && at < 60_000, 'and its Enter starts at the slide clock, not in a day’s time');
  // Stepping back parks it again, so it re-enters if it is reached a second time.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.ok(frag.classList.contains('seq-off'), 'back off the slide');
  ctl.close(); cleanup();
});

test('motion: reduced motion strips the moving parts and keeps the timing', () => {
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    const src = makeMotionSource([
      { id: 'a', boxes: [{ id: 'plain', prEnter: 'fade' }, { id: 'frag', build: 1, prEnter: 'rise' }] },
      { id: 'b' },
    ]);
    const ctl = openPresentMode({ source: src })!;
    assert.ok(stageEl()!.classList.contains('pr-reduced'));
    assert.equal(cloneBox(0, 'plain')!.hasAttribute('data-t-enter'), false, 'nothing animates in');
    assert.equal(cloneBox(0, 'frag')!.hasAttribute('data-t-enter'), false);
    // The fragment is still a fragment: it is held back, it just cuts in when clicked.
    assert.ok(cloneBox(0, 'frag')!.classList.contains('seq-off'));
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.ok(!cloneBox(0, 'frag')!.classList.contains('seq-off'), 'revealed with a cut');
    ctl.close(); cleanup();
  } finally { delete document.documentElement.dataset.a11yMotion; }
});

test('motion: leaving a slide with no exits swaps the classes NOW', () => {
  const src = makeMotionSource([
    { id: 'a', boxes: [{ id: 'x', prEnter: 'fade', prEnterMs: 3000 }] },
    { id: 'b', boxes: [{ id: 'y', prEnter: 'fade' }] },
  ]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  // Synchronously after the key: nothing had an Exit, so the deck has already moved.
  assert.equal(ctl.frameId, 'b');
  assert.ok(clones()[1]!.classList.contains('pr-active'), 'slide b is active on this tick');
  assert.ok(clones()[0]!.classList.contains('pr-past'), 'and slide a is behind it');
  ctl.close(); cleanup();
});

test('motion: a with-the-slide box with an Exit plays it, and the slide leaves when it is done (plans/184 R4)', async () => {
  const src = makeMotionSource([
    { id: 'a', boxes: [{ id: 'x', prEnter: 'fade', prExit: 'fade', prExitMs: 150 }, { id: 'plain' }] },
    { id: 'b', boxes: [{ id: 'y', prEnter: 'fade' }] },
  ]);
  const ctl = openPresentMode({ source: src })!;
  const x = cloneBox(0, 'x')!;
  assert.equal(x.hasAttribute('data-t-dur'), false, 'open-ended on arrival');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  // The move is HELD: the box now has an out point that puts its exit at the clock.
  assert.equal(ctl.frameId, 'a', 'still on slide a while the exit plays');
  assert.equal(stageEl()!.dataset.prLeaving, '1');
  const dur = Number(x.getAttribute('data-t-dur'));
  assert.ok(Number.isFinite(dur) && dur >= 150 && dur < 1000, `an out point of about the exit length, got ${dur}`);
  assert.equal(x.getAttribute('data-pr-leave-dur'), '1', 'marked, so the next arrival can take it back');
  assert.equal(cloneBox(0, 'plain')!.hasAttribute('data-t-dur'), false, 'a box with no Exit is left alone');
  await delay(260);
  assert.equal(ctl.frameId, 'b', 'then the deck moved on its own');
  assert.equal(stageEl()!.dataset.prLeaving, undefined);
  assert.ok(clones()[1]!.classList.contains('pr-active'));
  // Back to slide a: the out point is gone, so the box is on the slide again.
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(ctl.frameId, 'a');
  assert.equal(x.hasAttribute('data-t-dur'), false, 'the leave’s out point was taken back on arrival');
  assert.equal(x.hasAttribute('data-pr-leave-dur'), false);
  ctl.close(); cleanup();
});

test('motion: a second move during the exit wait goes at once, to the newer target', async () => {
  const src = makeMotionSource([
    { id: 'a', boxes: [{ id: 'x', prExit: 'fade', prExitMs: 400 }] },
    { id: 'b' },
    { id: 'c' },
  ]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(ctl.frameId, 'a', 'held for the exit');
  ctl.go('c');
  assert.equal(ctl.frameId, 'c', 'the second move did not wait, and went where it was asked');
  await delay(450);
  assert.equal(ctl.frameId, 'c', 'the held move never fired afterwards');
  ctl.close(); cleanup();
});

test('motion: reduced motion strips exits too, so a leave never waits', () => {
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    const src = makeMotionSource([
      { id: 'a', boxes: [{ id: 'x', prExit: 'fade', prExitMs: 3000 }] },
      { id: 'b' },
    ]);
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(ctl.frameId, 'b', 'moved on this tick');
    ctl.close(); cleanup();
  } finally { delete document.documentElement.dataset.a11yMotion; }
});

test('transition: a move plays the EARLIER frame’s own transition, both directions', () => {
  const src = makeMotionSource([{ id: 'a', transition: 'fade' }, { id: 'b' }, { id: 'c' }]);
  const ctl = openPresentMode({ source: src, transition: 'slide' })!;
  const stage = stageEl()!;
  assert.equal(stage.dataset.prTransition, 'slide', 'the deck’s own until a move is made');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));   // a → b
  assert.equal(stage.dataset.prTransition, 'fade', 'frame a governs the a/b pair');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));   // b → c
  assert.equal(stage.dataset.prTransition, 'slide', 'frame b names none, so the deck’s stands');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));    // c → b
  assert.equal(stage.dataset.prTransition, 'slide');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft' }));    // b → a
  assert.equal(stage.dataset.prTransition, 'fade', 'the same pair, the same transition, going back');
  ctl.close(); cleanup();
});

test('transition: `custom` on a frame hands the move back to the deck', () => {
  const src = makeMotionSource([{ id: 'a', transition: 'custom' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src, transition: 'fade' })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(stageEl()!.dataset.prTransition, 'fade', 'nothing is derived from custom');
  ctl.close(); cleanup();
});

// ---- Flight (section 7): a camera over the canvas, not a swap of two pages ----------

test('flight: the stage goes to canvas mode and the camera ends framing the destination', async () => {
  const src = makeMotionSource([{ id: 'a', transition: 'flight' }, { id: 'b' }]);
  const ctl = openPresentMode({ source: src })!;
  const stage = stageEl()!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(stage.dataset.prTransition, 'flight');
  assert.ok(stage.classList.contains('pr-canvas'), 'the deck is laid out on the canvas');
  assert.equal(ctl.frameId, 'b', 'the slide changed immediately; only the camera travels');
  const frames = stage.querySelector<HTMLElement>('.pr-frames')!;
  // Each page sits at its AUTHORED position - the camera does the rest.
  assert.equal(clones()[1]!.style.getPropertyValue('--pr-cx'), '2000px');
  const view = { w: win.innerWidth, h: win.innerHeight };
  const path = flightPath({ x: 0, y: 0, w: 1920, h: 1080 }, { x: 2000, y: 0, w: 1920, h: 1080 }, view)!;
  await delay(path.total + 120);
  const want = cameraFor({ x: 2000, y: 0, w: 1920, h: 1080 }, view, FLIGHT_MARGIN);
  assert.equal(frames.style.getPropertyValue('--pr-cam-s'), String(want.scale), 'arrived at B’s scale');
  assert.equal(frames.style.getPropertyValue('--pr-cam-x'), `${want.tx}px`, 'and B’s offset');
  assert.equal(frames.style.getPropertyValue('--pr-cam-y'), `${want.ty}px`);
  ctl.close(); cleanup();
});

test('flight: a later move that is not a flight leaves canvas mode behind', async () => {
  const src = makeMotionSource([{ id: 'a', transition: 'flight' }, { id: 'b', transition: 'fade' }, { id: 'c' }]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.ok(stageEl()!.classList.contains('pr-canvas'));
  await delay(60);   // mid-flight: the camera is still travelling when the next key arrives
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  assert.equal(stageEl()!.classList.contains('pr-canvas'), false, 'back to the stacked deck for a fade');
  assert.equal(stageEl()!.dataset.prTransition, 'fade');
  // The abandoned flight lets go of the frame it was holding on screen: slide a is two
  // steps behind now, so the ordinary window rule unloads it.
  assert.equal(ctl.frameId, 'c');
  assert.equal(clones()[0]!.hasAttribute('hidden'), true, 'the frame the flight left behind is unloaded');
  ctl.close(); cleanup();
});

test('flight: reduced motion crossfades instead of flying', () => {
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    const src = makeMotionSource([{ id: 'a', transition: 'flight' }, { id: 'b' }]);
    const ctl = openPresentMode({ source: src })!;
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(stageEl()!.classList.contains('pr-canvas'), false, 'no camera move');
    assert.equal(stageEl()!.dataset.prTransition, 'fade', 'a crossfade instead');
    assert.equal(ctl.frameId, 'b', 'and the deck still advanced');
    ctl.close(); cleanup();
  } finally { delete document.documentElement.dataset.a11yMotion; }
});

test('motion: a slide that arrives BEHIND the overview map holds its clock until the map is down', async () => {
  // `setOverview` pauses the session that happens to be open when the map goes up, which
  // is not the same as pausing every session. Several keys navigate WITHOUT leaving the
  // map - End and Home are two - so the arriving slide used to start ticking where nobody
  // could see it, and by the time the map came down its entrance was already spent.
  const src = makeMotionSource([
    { id: 'a' },
    { id: 'b' },
    { id: 'c', boxes: [{ id: 'headline', prEnter: 'fade', prEnterMs: 2000 }] },
  ]);
  const ctl = openPresentMode({ source: src })!;
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'o' }));
  assert.equal(ctl.overview, true, 'the map is up');
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End' }));
  assert.equal(ctl.frameId, 'c', 'and End jumped without closing it');

  const headline = cloneBox(2, 'headline')!;
  assert.equal(headline.style.opacity, '0', 'posed at the start of its own fade');
  await new Promise((r) => { setTimeout(r, 140); });
  assert.equal(headline.style.opacity, '0', 'still at the start: the clock is held, not running');

  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'o' }));
  assert.equal(ctl.overview, false, 'the map is down');
  await new Promise((r) => { setTimeout(r, 140); });
  assert.ok(Number(headline.style.opacity) > 0,
    `the entrance plays for the audience that can now see it (opacity ${headline.style.opacity})`);
  ctl.close(); cleanup();
});
