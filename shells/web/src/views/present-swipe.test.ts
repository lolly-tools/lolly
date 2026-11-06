// SPDX-License-Identifier: MPL-2.0
/**
 * Touch swiping in present mode (present-swipe.ts): the release rule, the poses a finger
 * holds for each authored transition, which touches are refused, and the gesture state
 * machine under jsdom. Real touch input, real scrolling and the stylesheet's transitions
 * are covered by tests/present-swipe.browser.test.ts.
 *
 * Run directly:  node --test shells/web/src/views/present-swipe.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;

const swipe = await import('./present-swipe.ts');
const {
  swipeAxis, swipeCommits, followPoses, endPose, followsFinger, swipeRefusal, mountPresentSwipe,
  SWIPE_SLOP_PX, SWIPE_MIN_PX, SWIPE_LONG_PRESS_MS, SLIDE_TRAVEL_VW,
} = swipe;
type SwipePlan = import('./present-swipe.ts').SwipePlan;

test('a touch picks an axis only once it leaves the slop, and sideways must clearly win', () => {
  assert.equal(swipeAxis(SWIPE_SLOP_PX - 1, 0), null);
  assert.equal(swipeAxis(-30, 4), 'x');
  assert.equal(swipeAxis(4, 30), 'y');
  assert.equal(swipeAxis(20, 20), 'y', 'a diagonal is a scroll, not a swipe');
});

test('a release commits on distance or on a throw that would coast far enough', () => {
  const w = 390;
  assert.equal(swipeCommits(-40, 0, w), false, 'a short still release cancels');
  assert.equal(swipeCommits(-0.31 * w, 0, w), true, 'past the commit share, released still');
  assert.equal(swipeCommits(-40, -0.8, w), true, 'a short fast flick commits');
  assert.equal(swipeCommits(-(SWIPE_MIN_PX - 1), -3, w), false, 'too short to count, however fast');
  assert.equal(swipeCommits(140, -0.6, w), false, 'thrown back the other way cancels');
  assert.equal(swipeCommits(-200, 0, 0), false, 'no stage, no swipe');
});

test('only the slide and fade transitions follow the finger', () => {
  assert.deepEqual(['slide', 'fade', 'none', 'morph', 'flight', 'custom'].map(followsFinger), [true, true, false, false, false, false]);
});

test('the slide transition is scrubbed along its authored push and fade', () => {
  const half = followPoses('slide', 0.5, 40, 1);
  assert.deepEqual(half.leaving, { tx: -20, ty: 0, op: 0.5 });
  assert.deepEqual(half.arriving, { tx: 20, ty: 0, op: 0.5 });
  const back = followPoses('slide', 0.25, 40, -1);
  assert.deepEqual(back.leaving, { tx: 10, ty: 0, op: 0.75 });
  assert.deepEqual(back.arriving, { tx: -30, ty: 0, op: 0.25 });
  const fade = followPoses('fade', 0.4, 40, 1);
  assert.equal(fade.leaving.tx === 0 && fade.arriving.tx === 0, true, 'a fade never travels');
  assert.equal(fade.arriving.op, 0.4);
  assert.deepEqual(followPoses('slide', 3, 40, 1).arriving, { tx: 0, ty: 0, op: 1 }, 'progress is clamped');
});

test('the end of a deck gives a little and never more than one push', () => {
  assert.ok(endPose(-60, 40).tx < 0 && endPose(-60, 40).tx > -40);
  assert.ok(endPose(5000, 40).tx < 40);
  assert.equal(endPose(0, 40).tx, 0);
});

test('the stylesheet pushes by the travel the finger scrubs, and leaves vertical pans to the browser', () => {
  const css = readFileSync(new URL('../styles/parts/present.css', import.meta.url), 'utf8');
  assert.match(css, new RegExp(`\\.pr-page\\.pr-past\\s*\\{\\s*--pr-tx:\\s*-${SLIDE_TRAVEL_VW}vw`));
  assert.match(css, new RegExp(`\\.pr-page\\.pr-future\\s*\\{\\s*--pr-tx:\\s*${SLIDE_TRAVEL_VW}vw`));
  assert.match(css, /\.pr-stage\s*\{\s*touch-action:\s*pan-y pinch-zoom;\s*\}/);
  assert.match(css, /\.pr-stage\.pr-zoomed\s*\{\s*touch-action:\s*auto;\s*\}/);
});

function stageFixture(): { stage: HTMLElement; pages: HTMLElement[] } {
  document.body.innerHTML = `<div class="pr-stage"><div class="pr-frames">
    <div class="pr-page pr-active" data-pr-index="0"><p class="txt">Hello</p>
      <div class="lolly-box-web" data-interact="1"><div class="card">Demo</div></div>
      <video controls></video></div>
    <div class="pr-page pr-future pr-next" data-pr-index="1"></div>
    <div class="pr-page pr-future" data-pr-index="2" hidden></div>
  </div><button class="pr-tap pr-tap-next"></button>
  <div class="pr-hud"><button class="pr-hud-btn"></button></div>
  <div class="pr-speaker"><div class="pr-sp-now"><div class="pr-preview"></div></div><div class="pr-sp-notes">Notes</div></div></div>`;
  const stage = document.querySelector<HTMLElement>('.pr-stage')!;
  return { stage, pages: [...stage.querySelectorAll<HTMLElement>('.pr-page')] };
}

test('touches on chrome, controls, web page boxes and speaker notes are not swipes', () => {
  const { stage } = stageFixture();
  const q = (s: string) => stage.querySelector(s);
  assert.equal(swipeRefusal(q('.txt'), stage), null, 'slide text is the deck');
  assert.equal(swipeRefusal(q('.pr-tap-next'), stage), null, 'a swipe may start on an edge tap zone');
  assert.equal(swipeRefusal(q('.pr-sp-now .pr-preview'), stage), null, 'the speaker view Current slide swipes');
  assert.equal(swipeRefusal(q('.pr-hud-btn'), stage), 'chrome');
  assert.equal(swipeRefusal(q('.card'), stage), 'control', 'a web page box keeps its gestures, poster or not');
  assert.equal(swipeRefusal(q('video'), stage), 'control', 'video controls keep their scrubbing');
  assert.equal(swipeRefusal(q('.pr-sp-notes'), stage), 'speaker');
  assert.equal(swipeRefusal(document.body, stage), 'outside');
});

type Ev = { pointerType?: string; pointerId?: number; x: number; y: number; t: number; primary?: boolean };
function fire(target: Element, type: string, e: Ev): void {
  const ev = new win.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(ev, {
    pointerType: { value: e.pointerType ?? 'touch' }, pointerId: { value: e.pointerId ?? 1 },
    isPrimary: { value: e.primary ?? (e.pointerId ?? 1) === 1 },
    clientX: { value: e.x }, clientY: { value: e.y }, timeStamp: { value: e.t },
  });
  target.dispatchEvent(ev);
}
/** A drag from (x0, y) by `dx`, `steps` moves `stepMs` apart, then a release `holdMs` later. */
function drag(target: Element, dx: number, opts: { dy?: number; steps?: number; stepMs?: number; t0?: number; holdMs?: number; pointerType?: string } = {}): void {
  const { dy = 0, steps = 8, stepMs = 16, t0 = 1000, holdMs = 0, pointerType } = opts;
  fire(target, 'pointerdown', { x: 200, y: 400, t: t0, pointerType });
  for (let i = 1; i <= steps; i++) fire(target, 'pointermove', { x: 200 + (dx * i) / steps, y: 400 + (dy * i) / steps, t: t0 + i * stepMs, pointerType });
  fire(target, 'pointerup', { x: 200 + dx, y: 400 + dy, t: t0 + steps * stepMs + holdMs, pointerType });
}

function mount(opts: { reduced?: boolean; plan?: (d: 1 | -1) => SwipePlan; index?: () => number } = {}) {
  const { stage, pages } = stageFixture();
  Object.defineProperty(stage, 'clientWidth', { value: 390, configurable: true });
  const steps: number[] = [];
  const ctl = mountPresentSwipe({
    stage, pages, reduced: !!opts.reduced, enabled: () => true, index: opts.index ?? (() => 0),
    plan: opts.plan ?? ((d) => (d === 1 ? { index: 1, kind: 'slide', dir: 'right' } : 'end')),
    step: (d) => { steps.push(d); },
  });
  return { stage, pages, steps, ctl };
}

test('a sideways touch drag steps; a vertical one, a mouse drag or a short still one does not', () => {
  const { pages, steps, ctl } = mount();
  const txt = pages[0]!.querySelector('.txt')!;
  drag(txt, -220);
  assert.deepEqual(steps, [1], 'swiping left is Next');
  drag(txt, 10, { dy: 260 });
  drag(txt, -220, { pointerType: 'mouse' });
  drag(txt, -40, { stepMs: 40, holdMs: 80 });
  assert.deepEqual(steps, [1], 'a scroll, a mouse drag and a short swipe change nothing');
  drag(txt, 220);
  assert.deepEqual(steps, [1], 'at the start of a deck Back only gives');
  ctl.destroy();
});

test('a long press before moving is selection, not a swipe', () => {
  const { pages, steps, ctl } = mount();
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 200, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 196, y: 400, t: SWIPE_LONG_PRESS_MS + 50 });
  fire(txt, 'pointermove', { x: 100, y: 402, t: SWIPE_LONG_PRESS_MS + 80 });
  fire(txt, 'pointerup', { x: 100, y: 402, t: SWIPE_LONG_PRESS_MS + 90 });
  assert.deepEqual(steps, []);
  ctl.destroy();
});

test('a second finger stands the swipe down', () => {
  const { pages, steps, ctl } = mount();
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 200, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 160, y: 400, t: 16 });
  fire(txt, 'pointerdown', { x: 300, y: 400, t: 20, pointerId: 2 });
  fire(txt, 'pointermove', { x: 20, y: 400, t: 40 });
  fire(txt, 'pointerup', { x: 20, y: 400, t: 50 });
  assert.deepEqual(steps, []);
  assert.equal(pages[0]!.style.getPropertyValue('--pr-tx'), '', 'no pose is left behind');
  ctl.destroy();
});

test('the slide transition follows the finger, and only the two slides it joins', () => {
  const { pages, ctl } = mount();
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 300, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 280, y: 400, t: 16 });
  fire(txt, 'pointermove', { x: 105, y: 400, t: 32 });
  assert.equal(pages[0]!.style.transition, 'none');
  assert.equal(pages[0]!.style.getPropertyValue('--pr-op'), '0.5', 'the leaving slide is half faded at half the stage');
  assert.equal(pages[1]!.style.getPropertyValue('--pr-op'), '0.5');
  assert.equal(pages[2]!.style.getPropertyValue('--pr-op'), '', 'a slide outside the pair is untouched');
  fire(txt, 'pointercancel', { x: 105, y: 400, t: 40 });
  assert.equal(pages[0]!.style.getPropertyValue('--pr-op'), '', 'cancelled, the pose comes off at once');
  assert.match(pages[0]!.style.transition, /^transform \d+ms/, 'and the pages ease back on a transition of their own');
  ctl.destroy();
  assert.equal(pages[0]!.style.transition, '', 'destroy hands every page back');
});

test('a cut, a morph or a flight holds still under the finger and plays on release', () => {
  for (const kind of ['none', 'morph', 'flight']) {
    const { pages, steps, ctl } = mount({ plan: () => ({ index: 1, kind, dir: 'right' }) });
    const txt = pages[0]!.querySelector('.txt')!;
    fire(txt, 'pointerdown', { x: 300, y: 400, t: 0 });
    fire(txt, 'pointermove', { x: 100, y: 400, t: 16 });
    assert.equal(pages[0]!.style.getPropertyValue('--pr-tx'), '', `${kind} does not move while held`);
    fire(txt, 'pointerup', { x: 100, y: 400, t: 32 });
    assert.deepEqual(steps, [1], `${kind} commits on release`);
    ctl.destroy();
  }
});

test('reduced motion still swipes, with nothing following the finger', () => {
  const { pages, steps, ctl } = mount({ reduced: true });
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 300, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 100, y: 400, t: 16 });
  assert.equal(pages[0]!.style.getPropertyValue('--pr-tx'), '');
  fire(txt, 'pointerup', { x: 100, y: 400, t: 32 });
  assert.deepEqual(steps, [1]);
  ctl.destroy();
});

test('a deck that moves under the finger drops the swipe instead of stepping twice', () => {
  let index = 0;
  const { pages, steps, ctl } = mount({ index: () => index });
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 300, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 250, y: 400, t: 16 });
  index = 1; // a kiosk dwell ran out
  fire(txt, 'pointermove', { x: 100, y: 400, t: 32 });
  fire(txt, 'pointerup', { x: 100, y: 400, t: 48 });
  assert.deepEqual(steps, []);
  ctl.destroy();
});

test('a step that is not a slide change (a build) commits on release without moving the deck', () => {
  const { pages, steps, ctl } = mount({ plan: () => null });
  const txt = pages[0]!.querySelector('.txt')!;
  fire(txt, 'pointerdown', { x: 300, y: 400, t: 0 });
  fire(txt, 'pointermove', { x: 100, y: 400, t: 16 });
  assert.equal(pages[1]!.style.getPropertyValue('--pr-op'), '');
  fire(txt, 'pointerup', { x: 100, y: 400, t: 32 });
  assert.deepEqual(steps, [1]);
  ctl.destroy();
});

test('a swipe that started on an edge tap zone does not also tap it', () => {
  const { stage, steps, ctl } = mount();
  const tap = stage.querySelector('.pr-tap-next')!;
  let tapped = 0;
  tap.addEventListener('click', () => { tapped++; });
  drag(tap, -220);
  tap.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(steps, [1]);
  assert.equal(tapped, 0);
  ctl.destroy();
});
