// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-dom tests - the applier that puts a timed composition's LIVE DOM at a time.
 *
 * This module is the one copy of the "which box is on screen at t, and what does its
 * transition compose on top of the authored styles" logic. views/sequence-clock.ts
 * (the preview playhead) and bridge/export.ts renderLive ("Record live", which has to
 * advance the playhead itself while a MediaRecorder films the page) both go through
 * it, so the three things asserted here are the ones a drift would silently break:
 *
 *   • the AUTHORED transform survives - a box the user rotated stays rotated while an
 *     entrance animation plays over it (the composition bug this module exists for);
 *   • `seq-off` toggles on the half-open window boundaries, not a frame either side;
 *   • restore() leaves the DOM exactly as it was found, attribute string included.
 *
 * The pure readers (readTiming/isActiveAt/transitionAt/compose*) and applyTimeToElements
 * are already covered against jsdom in views/sequence-clock.test.ts, which imports them
 * through the clock's re-export - that suite is the parity check that the move did not
 * change behaviour, so it is not duplicated here.
 *
 * NOT covered (browser-only, stated plainly): the actual live capture. renderLive needs
 * getDisplayMedia + MediaRecorder + a compositor, so "the recorded webm contains motion"
 * can only be verified by exporting from a real browser. What is testable headlessly is
 * that the driver advances the DOM over wall-clock time and restores it - below.
 *
 * Run directly:  node --test shells/web/src/bridge/sequence-dom.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const {
  applySequenceTime, restoreSequenceTime, createSequenceTime, driveSequenceTime,
  sequenceStageOf, sequenceDurationMs, OFF_CLASS, SHOT_CLASS, BORROW_ATTR,
  releaseShotBorrow,
} = await import('./sequence-dom.ts');
// The rest pose a still export is taken at (plans/179 M4) - the one definition, shared
// with the CLI. Read here so the still and the composer are pinned against each other.
const { restMsOf } = await import('../lib/motion-model.ts');

/**
 * A two-clip magnetic row: `a` [0,1000) with a 400ms "rise" in and an AUTHORED rotation,
 * `b` [1000,2000). Mirrors what sequence-studio's hook stamps.
 */
function stage(): HTMLElement {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="2000">
      <div class="lolly-box" data-box-id="a" data-t-start="0" data-t-dur="1000"
           data-t-lane="seq" data-t-enter="rise" data-t-enter-ms="400"
           style="left:0px;top:0px;width:100px;height:50px;transform:rotate(-4deg);opacity:0.8"></div>
      <div class="lolly-box" data-box-id="b" data-t-start="1000" data-t-dur="1000"
           data-t-lane="seq" style="left:0px;top:0px;width:100px;height:50px"></div>
    </div>`;
  return root;
}

const box = (root: HTMLElement, id: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-box-id="${id}"]`)!;
const off = (el: HTMLElement): boolean => el.classList.contains(OFF_CLASS);
/**
 * Every declaration the applier is allowed to touch, per box.
 *
 * Deliberately NOT innerHTML: writing through CSSStyleDeclaration re-serialises the
 * whole `style` attribute (`a:0px;b:1px` becomes `a: 0px; b: 1px;`), which the module
 * documents as declaration-identical rather than byte-identical. Comparing the parsed
 * declarations is the contract; comparing the string would be testing jsdom's
 * serialiser.
 */
const snapshot = (root: HTMLElement): string => JSON.stringify(
  [...root.querySelectorAll<HTMLElement>('.lolly-box')].map((el) => ({
    cls: [...el.classList].sort(),
    style: (el.getAttribute('style') || '')
      .split(';').map(d => d.replace(/\s+/g, '')).filter(Boolean).sort(),
  })));

test('reads the stage and its declared length off the DOM', () => {
  const root = stage();
  assert.ok(sequenceStageOf(root), 'finds the [data-sequence] artboard below the root');
  assert.equal(sequenceDurationMs(root), 2000);
  assert.equal(sequenceDurationMs(dom.window.document.createElement('div')), 0,
    'an untimed node has no length (and is not a sequence)');
});

test('seq-off follows the HALF-OPEN window, on both boundaries', () => {
  const root = stage();
  const a = box(root, 'a'), b = box(root, 'b');

  applySequenceTime(root, 0);
  assert.equal(off(a), false, 'a is on at its own start');
  assert.equal(off(b), true, 'b has not begun');

  applySequenceTime(root, 999);
  assert.equal(off(a), false, 'a is still on one ms before its end');
  assert.equal(off(b), true);

  // The frame at exactly start+dur belongs to the NEXT clip - this is what makes a
  // gapless row cut cleanly instead of flashing both clips for one frame.
  applySequenceTime(root, 1000);
  assert.equal(off(a), true, 'a is off at exactly start+dur');
  assert.equal(off(b), false, 'b is on at exactly its start');

  applySequenceTime(root, 2000);
  assert.equal(off(b), true, 'past the end nothing is on screen');
  restoreSequenceTime(root);
});

// ── the thumbnail shot's borrow ─────────────────────────────────────────────
//
// lib/clip-thumbs.ts photographs an off-playhead box by lifting `seq-off` and parking the
// box 200vw away for up to 1.5s. The applier is the authority on visibility for that whole
// window, not just after the shot settles: scrubbing onto a parked box used to leave the
// LIVE scene off the viewport (a black stage) until the shot popped it back.

/** Exactly what borrowVisibility does to a box it is about to photograph. */
function borrow(el: HTMLElement, token = 't1'): void {
  el.classList.remove(OFF_CLASS);
  el.classList.add(SHOT_CLASS);
  el.setAttribute(BORROW_ATTR, token);
}

test('making a borrowed box ACTIVE revokes the lease and un-parks it', () => {
  const root = stage();
  const a = box(root, 'a');

  applySequenceTime(root, 1500);                 // a is off screen: photographable
  assert.equal(off(a), true);
  borrow(a);

  applySequenceTime(root, 200);                  // the user scrubs onto a, mid-shot
  assert.equal(off(a), false, 'the live scene is not hidden');
  assert.equal(a.classList.contains(SHOT_CLASS), false,
    'and not parked 200vw off the viewport either - this was the black stage');
  assert.equal(a.hasAttribute(BORROW_ATTR), false, 'the lease is revoked, so the restore stands down');
  restoreSequenceTime(root);
});

test('an INACTIVE box keeps what the shot borrowed - re-hiding it would photograph the blank', () => {
  const root = stage();
  const a = box(root, 'a');

  applySequenceTime(root, 1500);
  borrow(a);
  applySequenceTime(root, 1600);                 // another tick while a is still off screen
  assert.equal(off(a), false, 'the shot still owns the class it borrowed');
  assert.equal(a.classList.contains(SHOT_CLASS), true, 'and is still parked, so nothing shows');
  assert.equal(a.getAttribute(BORROW_ATTR), 't1', 'lease intact: the restore will re-hide it');
  restoreSequenceTime(root);
});

test('restore takes the lease with it, so a late restore cannot re-hide anything', () => {
  const root = stage();
  const a = box(root, 'a');
  applySequenceTime(root, 1500);
  borrow(a);
  restoreSequenceTime(root);
  assert.equal(a.hasAttribute(BORROW_ATTR), false);
  assert.equal(a.classList.contains(SHOT_CLASS), false);
});

test('releaseShotBorrow un-parks the BOX when the borrow was taken on a descendant', () => {
  const root = stage();
  const a = box(root, 'a');
  const kid = dom.window.document.createElement('div');
  a.appendChild(kid);
  a.classList.add(SHOT_CLASS);
  kid.setAttribute(BORROW_ATTR, 't9');

  releaseShotBorrow(kid);
  assert.equal(a.classList.contains(SHOT_CLASS), false, 'the park is on the box, the lease on the child');
  assert.equal(kid.hasAttribute(BORROW_ATTR), false);
  // Nothing borrowed, nothing to do - and no throw on a box that was never parked.
  releaseShotBorrow(box(root, 'b'));
});

test('an enter transition composes with the AUTHORED rotation instead of clobbering it', () => {
  const root = stage();
  const a = box(root, 'a');

  // Mid-transition: 200ms into a 400ms "rise" (it translates AND fades, so both the
  // transform and the opacity have to compose rather than replace).
  applySequenceTime(root, 200);
  const tr = a.style.transform;
  assert.match(tr, /rotate\(-4deg\)/, "the author's own rotation is still in the transform");
  assert.match(tr, /^translate\(/, 'the animation translate goes OUTSIDE the authored transform');
  assert.ok(tr.indexOf('translate(') < tr.indexOf('rotate(-4deg)'),
    'order is translate -> authored -> anim, matching the compositor\'s matrix order');
  // Authored opacity 0.8 × the transition's alpha - never replaced by the alpha alone.
  const mid = parseFloat(a.style.opacity);
  assert.ok(mid > 0 && mid < 0.8, `authored 0.8 is multiplied down mid-transition, got ${a.style.opacity}`);

  // At rest the authored declarations are handed straight back.
  applySequenceTime(root, 600);
  assert.equal(a.style.transform, 'rotate(-4deg)');
  assert.equal(a.style.opacity, '0.8');
  restoreSequenceTime(root);
});

test('restore leaves the DOM exactly as it was found', () => {
  const root = stage();
  const before = snapshot(root);

  applySequenceTime(root, 150);
  applySequenceTime(root, 1200);
  assert.notEqual(snapshot(root), before, 'the applier really did write something');

  restoreSequenceTime(root);
  assert.equal(snapshot(root), before, 'every class and inline property is back');

  // And a second restore is a no-op rather than an error.
  restoreSequenceTime(root);
  assert.equal(snapshot(root), before);
});

test('a session is reusable and its restore is the same guarantee', () => {
  const root = stage();
  const before = snapshot(root);
  const s = createSequenceTime(root);
  assert.equal(s.durationMs(), 2000);
  for (const t of [0, 100, 500, 1000, 1500, 1999]) s.apply(t);
  s.restore();
  assert.equal(snapshot(root), before);
});

// ── the live driver ─────────────────────────────────────────────────────────

/** A fake wall clock + scheduler, so the driver runs deterministically. */
function fakeClock() {
  let t = 0;
  const queue: Array<{ at: number; fn: () => void }> = [];
  return {
    now: () => t,
    schedule: (fn: () => void, ms: number) => {
      const item = { at: t + ms, fn };
      queue.push(item);
      return () => { const i = queue.indexOf(item); if (i >= 0) queue.splice(i, 1); };
    },
    /** Advance to `ms`, running everything due on the way. */
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = queue.filter(q => q.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        queue.splice(queue.indexOf(next), 1);
        t = next.at;
        next.fn();
      }
      t = end;
    },
    pending: () => queue.length,
  };
}

test('driveSequenceTime advances the playhead over wall-clock time', () => {
  const root = stage();
  const a = box(root, 'a'), b = box(root, 'b');
  const clock = fakeClock();
  const d = driveSequenceTime(root, { durationMs: 2000, fps: 10, now: clock.now, schedule: clock.schedule });

  d.start();
  assert.equal(off(a), false, 'frame 0 is applied synchronously on start - no blank first frame');
  assert.equal(off(b), true);

  clock.advance(1200);
  assert.equal(off(a), true, 'a has ended by t=1200');
  assert.equal(off(b), false, 'b is on screen - the DOM really moved without anyone scrubbing');

  // Past the end the last frame is HELD (a recorder may still be rolling); the loop
  // stops rather than spinning.
  clock.advance(2000);
  assert.equal(clock.pending(), 0, 'the driver stopped scheduling at the end');
  d.stop();
});

test('driveSequenceTime restores the DOM on stop, even mid-clip', () => {
  const root = stage();
  const before = snapshot(root);
  const clock = fakeClock();
  const d = driveSequenceTime(root, { durationMs: 2000, fps: 10, now: clock.now, schedule: clock.schedule });
  d.start();
  clock.advance(700);
  assert.notEqual(snapshot(root), before);

  d.stop();
  assert.equal(snapshot(root), before, 'stop puts every authored declaration back');
  assert.equal(clock.pending(), 0, 'and cancels the pending tick');

  // stop() before start(), and a double stop, are both no-ops.
  const d2 = driveSequenceTime(root, { durationMs: 100, now: clock.now, schedule: clock.schedule });
  d2.stop(); d2.stop();
  assert.equal(snapshot(root), before);
});

// ── authored easing ─────────────────────────────────────────────────────────
//
// The ease is a per-PHASE string on the box (`data-t-enter-ease` / `data-t-exit-ease`)
// that governs the transition's GEOMETRY only. The three properties worth pinning are
// the ones a regression would be invisible in: an unauthored box is byte-identical to
// what it rendered before the control existed, an authored one actually moves, and
// junk falls back rather than throwing mid-frame.

/** The same two-clip row, with an ease of the caller's choosing on `a`'s entrance. */
function easedStage(ease: string | null): HTMLElement {
  const root = stage();
  const a = box(root, 'a');
  if (ease === null) a.removeAttribute('data-t-enter-ease');
  else a.setAttribute('data-t-enter-ease', ease);
  return root;
}

/** `a`'s inline transform 100 ms into its 400 ms rise - a quarter of the way in. */
function riseTransform(ease: string | null): string {
  const root = easedStage(ease);
  applySequenceTime(root, 100);
  const out = box(root, 'a').style.transform;
  restoreSequenceTime(root);
  return out;
}

test('an unauthored ease renders exactly what it rendered before the control existed', () => {
  const bare = riseTransform(null);
  assert.equal(riseTransform(''), bare, 'an empty attribute is the same as no attribute');
  assert.ok(/translate\(/.test(bare), 'the rise is still animating at t=100');
});

test('an authored ease moves the geometry, and a preset agrees with its own bezier', () => {
  const bare = riseTransform(null);
  const linear = riseTransform('linear');
  assert.notEqual(linear, bare, 'linear is not the built-in easeOutCubic');
  // The preset name and the curve it stands for are the same authored value.
  assert.equal(riseTransform('cubic-bezier(0,0,1,1)'), linear);
  assert.notEqual(riseTransform('overshoot'), linear);
});

test('a junk ease falls back to the preset\'s own curve rather than throwing', () => {
  const bare = riseTransform(null);
  for (const junk of ['wobble', 'cubic-bezier(0,0,1)', 'cubic-bezier(2,0,1,1)', 'cubic-bezier(a,b,c,d)', '<script>']) {
    assert.equal(riseTransform(junk), bare, junk);
  }
});

test('the ease reaches the driver too - a live take is eased like the preview', () => {
  const clock = fakeClock();
  const runAt = (ease: string | null): string => {
    const root = easedStage(ease);
    const d = driveSequenceTime(root, { durationMs: 2000, fps: 10, now: clock.now, schedule: clock.schedule });
    d.start();
    clock.advance(100);
    const out = box(root, 'a').style.transform;
    d.stop();
    return out;
  };
  assert.equal(runAt(null), riseTransform(null));
  assert.equal(runAt('linear'), riseTransform('linear'));
});

// ── frames AS scenes: the applier gates [data-pdf-page] frame pages too (plan 92) ──────
// A sequenced Design frame doc has NO `.lolly-box` on the seq lane - its scenes are
// [data-pdf-page] frame pages carrying data-t-start/data-t-dur. The SAME generic
// [data-t-start] applier gates them: the page whose [start,start+dur) holds t stays
// visible, the others get `.seq-off` - a slide at a time. There is no [data-sequence]
// stage in a frames doc, so this also exercises the sequenceStageOf → root fallback.

function framesStage(): HTMLElement {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="lolly-frames">
      <div class="lolly-frame-page" data-pdf-page data-t-start="0" data-t-dur="3000" data-t-lane="seq"
           style="position:absolute;left:0px;top:0px;width:800px;height:600px"></div>
      <div class="lolly-frame-page" data-pdf-page data-t-start="3000" data-t-dur="3000" data-t-lane="seq"
           style="position:absolute;left:1000px;top:0px;width:800px;height:600px"></div>
    </div>`;
  return root;
}
const pageAt = (root: HTMLElement, i: number): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')][i]!;

test('applySequenceTime gates frame pages: the inactive page gets seq-off, the active one does not', () => {
  const root = framesStage();
  const a = pageAt(root, 0), b = pageAt(root, 1);

  applySequenceTime(root, 1500);   // inside frame A [0,3000)
  assert.equal(off(a), false, 'frame A is active at t=1.5s');
  assert.equal(off(b), true, 'frame B is hidden (its window starts at 3s)');

  applySequenceTime(root, 4500);   // inside frame B [3000,6000)
  assert.equal(off(a), true, 'frame A is now hidden');
  assert.equal(off(b), false, 'frame B is active at t=4.5s');

  // Half-open boundary: at exactly 3000 the cut belongs to B, not A.
  applySequenceTime(root, 3000);
  assert.equal(off(a), true, 'A ends at its half-open boundary');
  assert.equal(off(b), false, 'B owns the frame at exactly its start');

  restoreSequenceTime(root);
  assert.equal(off(a), false, 'restore lifts seq-off from every page');
  assert.equal(off(b), false);
});

test('an untimed (spatial) frame page is never gated', () => {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="lolly-frames">
      <div class="lolly-frame-page" data-pdf-page style="position:absolute;left:0px;top:0px;width:800px;height:600px"></div>
    </div>`;
  applySequenceTime(root, 5000);
  assert.equal(off(pageAt(root, 0)), false, 'a page with no data-t-start is never selected or hidden');
  restoreSequenceTime(root);
});

test('a FLAT box is projected the moment a camera moves - and walked not at all without one', () => {
  // The planner projects every .lolly-box once the view moves; the applier's element
  // set must agree, or the export pans a box the preview leaves frozen (found via
  // Choreograph, which mints exactly this state in one click).
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="2000">
      <div class="lolly-box" data-box-id="flat"
           style="left:10px;top:10px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="cam" data-t-kf="t0_x-120*t2000_x120">
        <div data-cam="1"></div>
      </div>
    </div>`;
  const flat = box(root, 'flat');
  // t = 500, not 1000: the pan crosses x = 0 exactly at the midpoint, where a resting
  // view would honestly not move anything.
  applySequenceTime(root, 500);
  try {
    assert.ok(flat.style.transform, 'the camera pan reaches the flat box in the preview');
    assert.match(flat.style.transform, /translate/, 'as a projected translate');
  } finally { restoreSequenceTime(root); }
  // Declaration-identical, per the module's own contract (the harness header says why
  // the raw attribute string is not the thing to compare).
  assert.equal(flat.style.transform, '', 'restore removes the projected transform');
  assert.equal(flat.style.left, '10px');
  assert.equal(flat.style.width, '100px');

  // Without a camera the flat box is not even walked: no writes, byte-identity.
  const still = dom.window.document.createElement('div');
  still.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="2000">
      <div class="lolly-box" data-box-id="flat" style="left:10px;top:10px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="a" data-t-start="0" data-t-dur="1000" data-t-lane="seq"
           style="left:0px;top:0px;width:100px;height:50px"></div>
    </div>`;
  const flat2 = box(still, 'flat');
  applySequenceTime(still, 500);
  try {
    assert.equal(flat2.style.transform, '', 'no camera, no write to a flat box');
  } finally { restoreSequenceTime(still); }
});

test('an authored BASE tilt is applied ONCE when posed - the baked prefix is stripped, everything after it survives', () => {
  // The hook bakes `perspective(1200px) rotateY() rotateX()` for the untimed board and
  // the stills, AND stamps data-t-rx/-ry for the fold. Without the strip the applier
  // wrote both and a 12 degree card rendered at ~24 (review blocker, 2026-09-02).
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="2000">
      <div class="lolly-box" data-box-id="t" data-t-rx="-40" data-t-ry="25"
           style="left:0px;top:0px;width:100px;height:50px;transform:perspective(1200px) rotateY(25deg) rotateX(-40deg) rotate(15deg)"></div>
      <div class="lolly-box" data-box-id="flat" data-t-start="0" data-t-dur="2000" data-t-lane="seq"
           style="left:0px;top:0px;width:100px;height:50px;transform:rotate(-4deg)"></div>
    </div>`;
  const tilted = box(root, 't');
  const plain = box(root, 'flat');
  applySequenceTime(root, 1000);
  try {
    const tf = tilted.style.transform;
    assert.match(tf, /^matrix3d\(/, 'the fold owns the tilt');
    assert.ok(!tf.includes('perspective('), 'the baked prefix is stripped, not doubled');
    assert.ok(tf.includes('rotate(15deg)'), 'the in-plane rotation after the prefix survives');
    assert.ok(plain.style.transform.includes('rotate(-4deg)'), 'an untilted authored transform is untouched');
  } finally { restoreSequenceTime(root); }
  assert.ok(tilted.getAttribute('style')!.includes('perspective(1200px) rotateY(25deg) rotateX(-40deg) rotate(15deg)'),
    'restore hands the baked string back for the stills');
});

test('a TILTED scenery box on an UNTIMED board survives the clock - visible, posed once', () => {
  // Opening the timeline on a board where nothing is timed runs the applier with
  // seqMs = 0. A tilt (or a lift) is what puts the box in the applier's set, and the
  // open-ended window used to collapse to nothing there - the box vanished the moment
  // the clock existed (caught live, 2026-09-02).
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard">
      <div class="lolly-box" data-box-id="t" data-t-rx="-18" data-t-ry="25"
           style="left:0px;top:0px;width:320px;height:240px;transform:perspective(1200px) rotateY(25deg) rotateX(-18deg)"></div>
    </div>`;
  const el = box(root, 't');
  applySequenceTime(root, 500);
  try {
    assert.ok(!off(el), 'no window to be outside of, so the box stays on screen');
    const tf = el.style.transform;
    assert.match(tf, /^matrix3d\(/, 'posed through the fold');
    assert.ok(!tf.includes('perspective('), 'and the baked prefix is stripped - one tilt, not two');
  } finally { restoreSequenceTime(root); }
});

// ── the rest pose: what a per-artboard STILL is photographed at (plans/179 M4) ──

test('a still page composes at its rest pose - every entrance finished, nothing mid-fade', () => {
  // The bug this pins: a per-artboard export lifted `.seq-off` so each page was on
  // stage, but never said WHEN to photograph it - so a page whose boxes fade in over
  // 400 ms exported as a page of half-transparent boxes.
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="lolly-frame-page" data-pdf-page data-sequence data-seq-ms="4000">
      <div class="lolly-box" data-box-id="in" data-t-start="0" data-t-enter="rise" data-t-enter-ms="400"
           style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="late" data-t-start="600" data-t-enter="fade" data-t-enter-ms="500"
           style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="split" data-t-start="0" data-t-enter="fade" data-t-enter-ms="400"
           data-t-split="word" data-t-stagger="120"
           style="left:0px;top:0px;width:300px;height:50px"><span class="lly-u">a</span> <span class="lly-u">b</span> <span class="lly-u">c</span></div>
    </div>`;
  const page = root.firstElementChild as HTMLElement;
  const before = snapshot(page);

  // The LAST arrival wins: the late box finishes at 600 + 500, past the split tail
  // (400 + two 120 ms deals = 640) and past the first box's 400.
  assert.equal(restMsOf(page), 1100);

  // At t = 0 the page is mid-entrance, which is exactly what a still must not catch.
  applySequenceTime(page, 0);
  assert.match(box(page, 'in').style.transform, /translate/, 'the rise is still travelling at t=0');
  assert.equal(box(page, 'in').style.opacity, '0');
  assert.ok(off(box(page, 'late')), 'and the late box has not arrived at all');
  restoreSequenceTime(page);

  applySequenceTime(page, restMsOf(page));
  try {
    for (const id of ['in', 'late', 'split']) {
      const el = box(page, id);
      assert.ok(!off(el), `${id} is on screen at rest`);
      assert.equal(el.style.transform, '', `${id} has no entrance transform left`);
      assert.ok(el.style.opacity === '' || Number(el.style.opacity) >= 0.999, `${id} is opaque: ${el.style.opacity}`);
    }
    // The split tail reaches the UNITS, not just the box: the last word of a staggered
    // line is the thing that arrives last, and it has to be there too.
    for (const u of [...page.querySelectorAll<HTMLElement>('.lly-u')]) {
      assert.ok(u.style.opacity === '' || Number(u.style.opacity) >= 0.999, `unit opaque: ${u.style.opacity}`);
    }
  } finally { restoreSequenceTime(page); }
  assert.equal(snapshot(page), before, 'and the page is handed back exactly as it was found');
});

test('what never settles does NOT drag the still back to its own beginning', () => {
  // A keyframe track and a hold effect are cyclical or continuous: there is no "after" to
  // photograph, so they used to be a CEILING on the page - the earliest of their starts
  // won, and a scenery decoration carries no start at all, i.e. 0. One gently pulsing
  // shape therefore decided that every other box on the slide was photographed at t = 0,
  // mid-entrance, and the exported artboard came out blank. One still is one moment, and
  // the moment belongs to the boxes that do settle.
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="lolly-frame-page" data-pdf-page data-sequence data-seq-ms="4000">
      <div class="lolly-box" data-box-id="in" data-t-start="0" data-t-enter="rise" data-t-enter-ms="400"
           style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="kf" data-t-kf="t0_x0*t2000_x200"
           style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="hold" data-t-start="0" data-t-hold="pulse" data-t-hold-rate="1"
           style="left:0px;top:0px;width:100px;height:50px"></div>
    </div>`;
  const page = root.firstElementChild as HTMLElement;
  const before = snapshot(page);
  assert.equal(restMsOf(page), 400, 'the rise still decides the moment; the scenery does not');

  applySequenceTime(page, restMsOf(page));
  try {
    const rise = box(page, 'in');
    assert.equal(rise.style.transform, '', 'the entrance has finished');
    assert.ok(rise.style.opacity === '' || Number(rise.style.opacity) >= 0.999, 'and is opaque');
  } finally { restoreSequenceTime(page); }

  // Both of the never-settling boxes ARE moving - the page below is a pose, not an inert
  // board, which is why one of them must not be allowed to speak for the whole page.
  applySequenceTime(page, 900);
  try {
    assert.match(box(page, 'kf').style.transform, /translate\(7\d(\.\d+)?px/, 'the track is part way along');
    assert.match(box(page, 'hold').style.transform, /scale\(0\.9\d+\)/, 'and the pulse is part way through');
  } finally { restoreSequenceTime(page); }
  assert.equal(snapshot(page), before);
});

test('the per-artboard still is composed on the DOCUMENT, drawn whole, and refuses depth', () => {
  // The three rules the still export (views/tool-actions.ts) depends on, pinned against
  // the real applier because each one was got wrong by composing a single PAGE:
  //
  //   1. the frames-as-scenes DEPTH OPT-OUT is latched from the `[data-pdf-page]`
  //      elements, which are not descendants of any one page - so a page-scoped session
  //      projected a lifted box through a camera the preview and the compositor refuse;
  //   2. `data-seq-ms` is stamped on the `.lolly-frames` root, so a page-scoped session
  //      measured every open-ended box against "no sequence at all";
  //   3. the applier HIDES whatever is outside its window - inside the page it was asked
  //      to pose - so a still of a slide with staggered bullets came out showing only the
  //      last one. The exporter keeps the pose and lifts the hiding again.
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="lolly-frames" data-seq-ms="8000">
      <div class="lolly-frame-page" data-pdf-page data-frame-id="f1" data-t-start="0" data-t-dur="4000"
           data-t-lane="seq" style="position:absolute;left:0px;top:0px;width:800px;height:600px">
        <div class="lolly-box" data-box-id="early" data-t-start="0" data-t-dur="1000"
             data-t-enter="fade" data-t-enter-ms="400" style="left:0px;top:0px;width:100px;height:50px"></div>
        <div class="lolly-box" data-box-id="late" data-t-start="1000" data-t-dur="1000"
             data-t-enter="fade" data-t-enter-ms="400" style="left:0px;top:0px;width:100px;height:50px"></div>
        <div class="lolly-box" data-box-id="lift" data-t-start="0" data-t-z="120"
             style="left:0px;top:0px;width:100px;height:50px"></div>
      </div>
      <div class="lolly-frame-page" data-pdf-page data-frame-id="f2" data-t-start="4000" data-t-dur="4000"
           data-t-lane="seq" style="position:absolute;left:1000px;top:0px;width:800px;height:600px"></div>
    </div>`;
  const page = pageAt(root, 0);
  const before = snapshot(page);

  assert.equal(sequenceDurationMs(root), 8000, 'the document knows its own length…');
  assert.equal(sequenceDurationMs(page), 0, '…and a single page does not - rule 2');

  // The three steps the exporter runs, per page.
  const rest = restMsOf(page);
  assert.equal(rest, 1400, 'the last enter on this page finishes at 1000 + 400');
  applySequenceTime(root, rest);
  for (const o of [...root.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)]) o.classList.remove(OFF_CLASS);
  try {
    for (const id of ['early', 'late', 'lift']) {
      assert.ok(!off(box(page, id)), `${id} is drawn - a still of an artboard draws all of it`);
    }
    assert.equal(box(page, 'lift').style.transform, '',
      'a frames document opts out of depth, so nothing is projected - rule 1');
  } finally { restoreSequenceTime(root); }
  assert.equal(snapshot(page), before, 'and the page is handed back exactly as it was found');

  // The control: hand the SAME composition a single page and the opt-out is bypassed,
  // because the elements that declare it are outside the subtree.
  applySequenceTime(page, rest);
  try {
    assert.notEqual(box(page, 'lift').style.transform, '',
      'page-scoped, the lift IS projected - which is the divergence rule 1 exists to stop');
  } finally { restoreSequenceTime(page); }
  assert.equal(snapshot(page), before);
});
