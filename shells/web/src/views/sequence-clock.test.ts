// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-clock tests.
 *
 * Three layers, all reachable without a browser:
 *   • the pure readers/composers (readTiming, isActiveAt, transitionAt,
 *     composeTransform/Opacity) - the half-open window and the authored-style
 *     composition are the two things a regression here would silently break;
 *   • applyTimeToElements against a jsdom element list - visibility class,
 *     transform/opacity composition around an AUTHORED rotate, and the exact
 *     restore when the playhead leaves a transition or the clip goes off screen;
 *   • the per-element seek queue, driven by a mock media element and an injected
 *     waitFrame - never two seeks in flight, latest-wins scrub coalescing, exactly
 *     one nudge retry, and a confirmation timeout that resolves instead of hanging;
 *   • the preview audio mix, against a fake AudioContext and an injected loader - 
 *     the (when, offset, duration) triple each box is scheduled with, which boxes are
 *     refused (muted, speed ≠ 1, over the memory ceiling, undecodable), and that every
 *     exit from playback leaves nothing running.
 *
 * NOT covered here (browser-only, deferred to the browser pass): that audible sound
 * actually reaches the output device, a real `decodeAudioData`, autoplay-policy
 * behaviour of a refused/resumed context, requestVideoFrameCallback confirmation, real
 * <video> drift correction, and layout-derived box sizes (jsdom reports 0 for
 * offsetWidth, so the tests below set style.width/height, which the module's
 * measure() falls back to).
 *
 * Run directly:  node --test shells/web/src/views/sequence-clock.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const {
  readTiming, endOf, isActiveAt, transitionAt, composeTransform, composeOpacity,
  createAuthoredStore, applyTimeToElements, createVideoSeeker, waitSeekConfirmed,
  createSequenceClock, OFF_CLASS, SEEK_NUDGE_S, SCRUB_THROTTLE_MS,
  MAX_PREVIEW_AUDIO_SOURCES,
  MODULE_EXTENSIONS, urlExtension, isModuleUrl, sniffTrackerModule, looksLikeTrackerModule,
} = await import('./sequence-clock.ts');

// ── fixtures ────────────────────────────────────────────────────────────────

interface BoxSpec {
  start?: number; dur?: number; clipIn?: number; speed?: number;
  enter?: string; enterMs?: number; exit?: string; exitMs?: number;
  mute?: boolean; lane?: string;
  /** true = an audio box on the default source; a string names its own source. */
  style?: string; audio?: boolean | string; w?: number; h?: number;
}

function box(spec: BoxSpec = {}): HTMLElement {
  const el = dom.window.document.createElement('div');
  el.className = 'lolly-box';
  if (spec.style) el.setAttribute('style', spec.style);
  el.style.width = `${spec.w ?? 200}px`;
  el.style.height = `${spec.h ?? 100}px`;
  if (spec.start != null) el.setAttribute('data-t-start', String(spec.start));
  if (spec.dur != null) el.setAttribute('data-t-dur', String(spec.dur));
  if (spec.clipIn != null) el.setAttribute('data-clip-in', String(spec.clipIn));
  if (spec.speed != null) el.setAttribute('data-t-speed', String(spec.speed));
  if (spec.enter != null) el.setAttribute('data-t-enter', spec.enter);
  if (spec.enterMs != null) el.setAttribute('data-t-enter-ms', String(spec.enterMs));
  if (spec.exit != null) el.setAttribute('data-t-exit', spec.exit);
  if (spec.exitMs != null) el.setAttribute('data-t-exit-ms', String(spec.exitMs));
  if (spec.mute) el.setAttribute('data-t-mute', '1');
  if (spec.lane) el.setAttribute('data-t-lane', spec.lane);
  if (spec.audio) {
    // Exactly what the tool hook emits: an inert marker carrying the source URL.
    const a = dom.window.document.createElement('div');
    a.className = 'lolly-box-audio';
    a.setAttribute('data-audio-src', typeof spec.audio === 'string' ? spec.audio : 'bed.ogg');
    a.setAttribute('aria-hidden', 'true');
    el.appendChild(a);
  }
  return el;
}

const ctxFor = (seqMs: number, store = createAuthoredStore()): { seqMs: number; store: ReturnType<typeof createAuthoredStore> } =>
  ({ seqMs, store });

// ── readers ─────────────────────────────────────────────────────────────────

test('readTiming: reads every attribute, clamps, and tolerates junk', () => {
  const t = readTiming(box({ start: 1000, dur: 2500, clipIn: 400, speed: 2, enter: 'rise', enterMs: 300, exit: 'fade', exitMs: 5000, mute: true, lane: 'seq' }));
  assert.equal(t.start, 1000);
  assert.equal(t.dur, 2500);
  assert.equal(t.clipIn, 400);
  assert.equal(t.speed, 2);
  assert.equal(t.enter, 'rise');
  assert.equal(t.enterMs, 300);
  assert.equal(t.exit, 'fade');
  assert.equal(t.exitMs, 3000);            // clamped to MAX_TRANSITION_MS
  assert.equal(t.mute, true);
  assert.equal(t.lane, 'seq');

  const junk = readTiming(box({ start: 0, speed: 99, enter: 'constructor', enterMs: 1 }));
  assert.equal(junk.dur, null);            // open-ended
  assert.equal(junk.speed, 4);             // clamped
  assert.equal(junk.enter, null);          // prototype key is NOT a transition kind
  assert.equal(junk.enterMs, 100);         // clamped up to MIN_TRANSITION_MS
  assert.equal(junk.lane, '');
});

test('endOf: an open-ended box runs to the sequence end', () => {
  const bounded = readTiming(box({ start: 500, dur: 1500 }));
  assert.equal(endOf(bounded, 9000), 2000);
  const open = readTiming(box({ start: 500 }));
  assert.equal(endOf(open, 9000), 9000);
  assert.equal(endOf(open, 0), 500);       // no derived length: degenerate to a point
});

test('isActiveAt: the window is half-open [start, start+dur)', () => {
  const t = readTiming(box({ start: 1000, dur: 2000 }));
  assert.equal(isActiveAt(t, 999, 5000), false);
  assert.equal(isActiveAt(t, 1000, 5000), true, 'start is INSIDE');
  assert.equal(isActiveAt(t, 2999, 5000), true);
  assert.equal(isActiveAt(t, 3000, 5000), false, 'start+dur is OUTSIDE');
  assert.equal(isActiveAt(t, 3001, 5000), false);
});

test('isActiveAt: a zero-length clip is never on screen', () => {
  const t = readTiming(box({ start: 1000, dur: 0 }));
  assert.equal(isActiveAt(t, 1000, 5000), false);
});

test('transitionAt: enter runs from the head, exit into the tail, rest is null', () => {
  const t = readTiming(box({ start: 1000, dur: 2000, enter: 'fade', enterMs: 400, exit: 'pop', exitMs: 400 }));
  assert.deepEqual(transitionAt(t, 1000, 5000), { kind: 'fade', p: 0, ease: '' });
  assert.deepEqual(transitionAt(t, 1200, 5000), { kind: 'fade', p: 0.5, ease: '' });
  assert.equal(transitionAt(t, 1400, 5000), null, 'enter finished → at rest');
  assert.equal(transitionAt(t, 2000, 5000), null);
  assert.deepEqual(transitionAt(t, 2800, 5000), { kind: 'pop', p: 0.5, ease: '' });
  const nearEnd = transitionAt(t, 2999, 5000);
  assert.equal(nearEnd?.kind, 'pop');
  assert.ok(nearEnd!.p < 0.01);
});

test('transitionAt: overlapping windows on a short clip - the further-from-rest one wins', () => {
  // 500 ms clip with 400 ms of each transition: the two windows overlap in the middle.
  const t = readTiming(box({ start: 0, dur: 500, enter: 'rise', enterMs: 400, exit: 'fade', exitMs: 400 }));
  assert.equal(transitionAt(t, 50, 5000)!.kind, 'rise', 'head belongs to enter');
  assert.equal(transitionAt(t, 450, 5000)!.kind, 'fade', 'tail belongs to exit');
});

test('transitionAt: an open-ended box never exits (its end moves as the comp is edited)', () => {
  const t = readTiming(box({ start: 0, exit: 'fade', exitMs: 400 }));
  assert.equal(transitionAt(t, 4900, 5000), null);
});

test('transitionAt: "none" is inert on both edges', () => {
  const t = readTiming(box({ start: 0, dur: 1000, enter: 'none', exit: 'none' }));
  assert.equal(transitionAt(t, 0, 5000), null);
  assert.equal(transitionAt(t, 999, 5000), null);
});

// ── composition ─────────────────────────────────────────────────────────────

test('composeTransform: authored transform is preserved and wrapped, never replaced', () => {
  const out = composeTransform('rotate(-4deg)', { dx: 10, dy: -5, sc: 0.5, rot: 12 });
  assert.equal(out, 'translate(10px, -5px) rotate(-4deg) rotate(12deg) scale(0.5)');
});

test('composeTransform: identity animation around an authored transform is the authored transform', () => {
  assert.equal(composeTransform('rotate(-4deg)', { dx: 0, dy: 0, sc: 1, rot: 0 }), 'rotate(-4deg)');
  assert.equal(composeTransform('', { dx: 0, dy: 0, sc: 1, rot: 0 }), '');
  assert.equal(composeTransform('none', { dx: 0, dy: 0, sc: 1, rot: 0 }), '');
});

test('composeOpacity: multiplies the authored opacity, clamped to [0,1]', () => {
  assert.equal(composeOpacity('0.8', 0.5), '0.4');
  assert.equal(composeOpacity('', 0.25), '0.25');
  assert.equal(composeOpacity('junk', 1), '1');
  assert.equal(composeOpacity('0.5', 5), '1');
});

// ── applyTimeToElements ─────────────────────────────────────────────────────

test('applyTimeToElements: adds/removes the off class across the exact boundaries', () => {
  const el = box({ start: 1000, dur: 2000 });
  const ctx = ctxFor(5000);
  applyTimeToElements([el], 999, ctx);
  assert.equal(el.classList.contains(OFF_CLASS), true);
  applyTimeToElements([el], 1000, ctx);
  assert.equal(el.classList.contains(OFF_CLASS), false);
  applyTimeToElements([el], 2999, ctx);
  assert.equal(el.classList.contains(OFF_CLASS), false);
  applyTimeToElements([el], 3000, ctx);
  assert.equal(el.classList.contains(OFF_CLASS), true, 'start+dur is off - half-open');
});

test('applyTimeToElements: an enter window composes with the authored rotate, then restores it exactly', () => {
  const el = box({ start: 0, dur: 2000, enter: 'fade', enterMs: 400, style: 'transform:rotate(-4deg);opacity:0.8;width:200px;height:100px' });
  const authoredTransform = el.style.transform;
  const authoredOpacity = el.style.opacity;
  assert.equal(authoredTransform, 'rotate(-4deg)');
  const ctx = ctxFor(5000);

  applyTimeToElements([el], 0, ctx);
  // fade: no offsets, alpha ramps over the first 60% of the window → 0 at p=0.
  assert.equal(el.style.transform, 'rotate(-4deg)', 'authored rotate survives the animation');
  assert.equal(el.style.opacity, '0');

  applyTimeToElements([el], 120, ctx);      // p = 0.3 → alpha = 0.3/0.6 = 0.5
  assert.equal(el.style.opacity, '0.4');    // × authored 0.8
  assert.equal(el.style.transform, 'rotate(-4deg)');

  applyTimeToElements([el], 1000, ctx);     // past the enter window → at rest
  assert.equal(el.style.transform, authoredTransform);
  assert.equal(el.style.opacity, authoredOpacity);
});

test('applyTimeToElements: a moving transition writes translate/scale around the authored transform', () => {
  const el = box({ start: 0, dur: 2000, enter: 'rise', enterMs: 400, style: 'transform:rotate(10deg);width:200px;height:100px' });
  applyTimeToElements([el], 0, ctxFor(5000));
  assert.match(el.style.transform, /^translate\(0px, 108px\) rotate\(10deg\)$/);
});

test('applyTimeToElements: leaving the clip restores the authored inline strings byte-for-byte', () => {
  const el = box({ start: 0, dur: 500, enter: 'pop', enterMs: 400, style: 'transform:rotate(-4deg);opacity:0.8;width:200px;height:100px' });
  const before = el.getAttribute('style');
  const ctx = ctxFor(5000);
  applyTimeToElements([el], 100, ctx);
  assert.notEqual(el.getAttribute('style'), before);
  applyTimeToElements([el], 900, ctx);      // off screen
  assert.equal(el.classList.contains(OFF_CLASS), true);
  assert.equal(el.style.transform, 'rotate(-4deg)');
  assert.equal(el.style.opacity, '0.8');
});

test('applyTimeToElements: a box with NO authored transform ends with no transform declaration', () => {
  const el = box({ start: 0, dur: 500, enter: 'pop', enterMs: 400 });
  const ctx = ctxFor(5000);
  applyTimeToElements([el], 10, ctx);
  assert.notEqual(el.style.transform, '');
  applyTimeToElements([el], 900, ctx);
  assert.equal(el.style.transform, '', 'removed, not set to an empty declaration');
  assert.equal((el.getAttribute('style') || '').includes('transform'), false);
});

test('applyTimeToElements: an audio box gets the visibility class but never a transform', () => {
  const el = box({ start: 0, dur: 500, enter: 'pop', enterMs: 400, audio: true });
  const ctx = ctxFor(5000);
  applyTimeToElements([el], 10, ctx);
  assert.equal(el.classList.contains(OFF_CLASS), false);
  assert.equal(el.style.transform, '');
  assert.equal(el.style.opacity, '');
});

test('applyTimeToElements: media callback reports clipIn + local × speed, and inactivity', () => {
  const el = box({ start: 1000, dur: 2000, clipIn: 500, speed: 2 });
  const seen: { sourceMs: number; active: boolean }[] = [];
  const ctx = { ...ctxFor(5000), media: (_el: HTMLElement, _t: unknown, sourceMs: number, active: boolean) => { seen.push({ sourceMs, active }); } };
  applyTimeToElements([el], 1500, ctx);
  applyTimeToElements([el], 4000, ctx);
  assert.deepEqual(seen[0], { sourceMs: 500 + 500 * 2, active: true });
  assert.equal(seen[1]!.active, false);
});

test('AuthoredStore: prune forgets detached elements, restoreAll puts the rest back', () => {
  const a = box({ start: 0, dur: 100, style: 'transform:rotate(2deg)' });
  const b = box({ start: 0, dur: 100 });
  const store = createAuthoredStore();
  applyTimeToElements([a, b], 0, { seqMs: 1000, store });
  assert.equal(store.size(), 2);
  store.prune(new Set([a]));
  assert.equal(store.size(), 1);
  store.restoreAll();
  assert.equal(a.style.transform, 'rotate(2deg)');
  assert.equal(store.size(), 0);
});

// ── seek queue ──────────────────────────────────────────────────────────────

interface Deferred { promise: Promise<number | null>; resolve(v: number | null): void }
const deferred = (): Deferred => {
  let resolve!: (v: number | null) => void;
  const promise = new Promise<number | null>((r) => { resolve = r; });
  return { promise, resolve };
};

/** A media element stand-in plus a controllable confirmation. */
function mockVideo() {
  const el = { currentTime: 0 };
  const calls: { t: number; d: Deferred }[] = [];
  let live = 0;
  let maxLive = 0;
  const waitFrame = (target: { currentTime: number }): Promise<number | null> => {
    live++;
    maxLive = Math.max(maxLive, live);
    const d = deferred();
    calls.push({ t: target.currentTime, d });
    return d.promise.then((v) => { live--; return v; });
  };
  return { el, calls, waitFrame, maxLive: () => maxLive };
}

test('seek queue: never two seeks in flight, and queued targets are latest-wins', async () => {
  const v = mockVideo();
  let clock = 0;
  const seeker = createVideoSeeker(v.el, { waitFrame: v.waitFrame, now: () => clock });
  seeker.request(1);
  seeker.request(2);
  seeker.request(3);
  assert.equal(v.calls.length, 1, 'only the first has been issued');
  assert.equal(seeker.inFlight(), true);
  // Land each in turn; the queue must issue exactly one at a time.
  for (let i = 0; i < 3 && i < v.calls.length; i++) {
    v.calls[i]!.d.resolve(v.calls[i]!.t);
    await new Promise((r) => setImmediate(r));
  }
  assert.equal(v.maxLive(), 1, 'the queue never overlapped two confirmations');
  // 2 was superseded by 3 while 1 was still in flight - the playhead's latest
  // position is the only one worth decoding.
  assert.deepEqual(v.calls.map((c) => c.t), [1, 3]);
  assert.equal(seeker.inFlight(), false);
  seeker.destroy();
});

test('seek queue: a scrub coalesces to the latest want, and the last one always lands', async () => {
  const v = mockVideo();
  let clock = 1000;
  const timers: { fn: () => void; ms: number }[] = [];
  const seeker = createVideoSeeker(v.el, {
    waitFrame: v.waitFrame,
    now: () => clock,
    schedule: (fn, ms) => { const e = { fn, ms }; timers.push(e); return () => { const i = timers.indexOf(e); if (i >= 0) timers.splice(i, 1); }; },
  });
  seeker.request(1, { scrubbing: true });     // first one goes immediately
  assert.deepEqual(v.calls.map((c) => c.t), [1]);
  clock += 10;
  seeker.request(2, { scrubbing: true });     // inside the throttle window → deferred
  clock += 10;
  seeker.request(3, { scrubbing: true });
  clock += 10;
  seeker.request(4, { scrubbing: true });     // the last one of the drag
  assert.deepEqual(v.calls.map((c) => c.t), [1], 'still just the first request issued');
  assert.equal(timers.length, 1, 'one trailing flush pending');
  assert.ok(timers[0]!.ms <= SCRUB_THROTTLE_MS);
  v.calls[0]!.d.resolve(1);
  await new Promise((r) => setImmediate(r));
  clock += 100;
  timers.shift()!.fn();                        // the trailing flush fires
  assert.deepEqual(v.calls.map((c) => c.t), [1, 4], 'the FINAL scrub position landed');
  seeker.destroy();
});

test('seek queue: a landing short of the target is nudged exactly once', async () => {
  const v = mockVideo();
  let clock = 0;
  const seeker = createVideoSeeker(v.el, { waitFrame: v.waitFrame, now: () => clock });
  seeker.request(5);
  assert.equal(v.calls.length, 1);
  v.calls[0]!.d.resolve(4.0);                  // decoder landed a whole second early
  await new Promise((r) => setImmediate(r));
  assert.equal(v.calls.length, 2, 'one nudge issued');
  assert.equal(v.calls[1]!.t, 5 + SEEK_NUDGE_S);
  assert.equal(seeker.nudges(), 1);
  v.calls[1]!.d.resolve(4.0);                  // still short - must NOT nudge again
  await new Promise((r) => setImmediate(r));
  assert.equal(v.calls.length, 2, 'the nudge is never retried');
  assert.equal(seeker.nudges(), 1);
  seeker.destroy();
});

test('seek queue: a landing within tolerance is not nudged', async () => {
  const v = mockVideo();
  const seeker = createVideoSeeker(v.el, { waitFrame: v.waitFrame, now: () => 0 });
  seeker.request(5);
  v.calls[0]!.d.resolve(5 + 1 / 30);           // one frame out - inside 1.5 frames
  await new Promise((r) => setImmediate(r));
  assert.equal(v.calls.length, 1);
  assert.equal(seeker.nudges(), 0);
  seeker.destroy();
});

test('seek queue: a superseded scrub target is never nudged toward', async () => {
  const v = mockVideo();
  let clock = 0;
  const timers: (() => void)[] = [];
  const seeker = createVideoSeeker(v.el, {
    waitFrame: v.waitFrame, now: () => clock,
    schedule: (fn) => { timers.push(fn); return () => { const i = timers.indexOf(fn); if (i >= 0) timers.splice(i, 1); }; },
  });
  seeker.request(1, { scrubbing: true });
  seeker.request(9, { scrubbing: true });      // queued as `want`
  v.calls[0]!.d.resolve(0);                    // the first landed miles off
  await new Promise((r) => setImmediate(r));
  assert.equal(seeker.nudges(), 0, 'a newer target is pending - no nudge toward the stale one');
  seeker.destroy();
});

test('seek queue: destroy drops queued work without leaving a seek in flight', async () => {
  const v = mockVideo();
  const seeker = createVideoSeeker(v.el, { waitFrame: v.waitFrame, now: () => 0 });
  seeker.request(1);
  seeker.request(2);
  seeker.destroy();
  v.calls[0]!.d.resolve(1);
  await new Promise((r) => setImmediate(r));
  assert.equal(v.calls.length, 1, 'the queued second seek was dropped by destroy');
});

test('waitSeekConfirmed: resolves null on timeout rather than hanging', async () => {
  const el = {
    currentTime: 3,
    addEventListener() { /* never fires */ },
    removeEventListener() { /* no-op */ },
  } as unknown as { currentTime: number };
  const t0 = Date.now();
  const landed = await waitSeekConfirmed(el, undefined, 20);
  assert.equal(landed, null);
  assert.ok(Date.now() - t0 >= 15);
});

test('waitSeekConfirmed: a `seeked` event resolves with the element time', async () => {
  const el = dom.window.document.createElement('video') as unknown as HTMLVideoElement & { currentTime: number };
  el.currentTime = 7.5;
  const p = waitSeekConfirmed(el as unknown as { currentTime: number }, undefined, 1000);
  el.dispatchEvent(new dom.window.Event('seeked'));
  assert.equal(await p, 7.5);
});

// ── the clock, end to end (no AudioContext involved) ────────────────────────

function stage(seqMs: number, specs: BoxSpec[]): { canvas: HTMLElement; els: HTMLElement[] } {
  const canvas = dom.window.document.createElement('div');
  const artboard = dom.window.document.createElement('div');
  artboard.className = 'artboard';
  artboard.setAttribute('data-sequence', '');
  artboard.setAttribute('data-seq-ms', String(seqMs));
  const els = specs.map((s) => box(s));
  for (const el of els) artboard.appendChild(el);
  canvas.appendChild(artboard);
  dom.window.document.body.appendChild(canvas);
  return { canvas, els };
}

/** rAF seam that runs synchronously, so a seek settles inside the test's tick. */
const syncRaf = { raf: (cb: () => void): number => { cb(); return 1; }, caf: (): void => { /* nothing pending */ } };

test('clock: seek applies the frame, reports duration from the DOM, and ticks subscribers', () => {
  const { canvas, els } = stage(6000, [{ start: 0, dur: 2000 }, { start: 2000, dur: 4000 }]);
  const seen: number[] = [];
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  const off = clock.onTick((t) => seen.push(t));
  assert.equal(clock.duration(), 6000);
  clock.seek(2500);
  assert.equal(clock.t(), 2500);
  assert.equal(els[0]!.classList.contains(OFF_CLASS), true);
  assert.equal(els[1]!.classList.contains(OFF_CLASS), false);
  assert.deepEqual(seen, [2500]);
  off();
  clock.seek(100);
  assert.deepEqual(seen, [2500], 'unsubscribed');
  assert.equal(clock.playing(), false);
  clock.destroy();
  canvas.remove();
});

test('clock: seek clamps to [0, duration]', () => {
  const { canvas } = stage(4000, [{ start: 0, dur: 4000 }]);
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  clock.seek(-50);
  assert.equal(clock.t(), 0);
  clock.seek(99999);
  assert.equal(clock.t(), 4000);
  clock.seek(Number.NaN);
  assert.equal(clock.t(), 0);
  clock.destroy();
  canvas.remove();
});

test('clock: an untimed composition (no data-seq-ms) reports duration 0 and stays inert', () => {
  const canvas = dom.window.document.createElement('div');
  const art = dom.window.document.createElement('div');
  canvas.appendChild(art);
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  assert.equal(clock.duration(), 0);
  clock.seek(1234);
  assert.equal(clock.t(), 1234, 'no derived length → no ceiling to clamp against');
  clock.destroy();
});

/**
 * Inline style compared as a SET OF DECLARATIONS, not as a byte string: writing any
 * property through a CSSStyleDeclaration makes the engine re-serialise the whole
 * `style` attribute (`a:b;c:d` → `a: b; c: d;`), so a byte comparison would fail a
 * restore that is exactly right. What the clock owes is the same declarations with
 * the same values - nothing added, nothing dropped, nothing changed.
 */
function decls(style: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (style || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

test('clock: destroy restores every inline style declaration and drops the off class', () => {
  const { canvas, els } = stage(6000, [
    { start: 0, dur: 1000, enter: 'pop', enterMs: 400, style: 'transform:rotate(-4deg);opacity:0.8;width:200px;height:100px' },
    { start: 4000, dur: 1000 },
  ]);
  const before = els.map((el) => el.getAttribute('style'));
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  clock.seek(100);
  assert.notEqual(els[0]!.getAttribute('style'), before[0]);
  assert.equal(els[1]!.classList.contains(OFF_CLASS), true);
  clock.destroy();
  assert.deepEqual(decls(els[0]!.getAttribute('style')), decls(before[0]), 'declaration-identical restore');
  assert.deepEqual(decls(els[1]!.getAttribute('style')), decls(before[1]));
  assert.equal(els[0]!.classList.contains(OFF_CLASS), false);
  assert.equal(els[1]!.classList.contains(OFF_CLASS), false);
  assert.equal(els[0]!.className, 'lolly-box');
  canvas.remove();
});

test('clock: reapply picks up boxes minted by a canvas rebuild', () => {
  const { canvas } = stage(6000, [{ start: 0, dur: 1000 }]);
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  clock.seek(3000);
  // Simulate the tool paint: the artboard's children are replaced wholesale.
  const art = canvas.querySelector('.artboard')!;
  art.innerHTML = '';
  const fresh = box({ start: 2000, dur: 2000 });
  art.appendChild(fresh);
  clock.reapply();
  assert.equal(fresh.classList.contains(OFF_CLASS), false, 'the new box is live at 3000ms');
  assert.equal(clock.t(), 3000);
  clock.destroy();
  canvas.remove();
});

test('clock: zero model writes - it only ever reads the DOM', () => {
  const { canvas } = stage(6000, [{ start: 0, dur: 1000 }]);
  // There is nothing to spy on by construction: the factory takes no runtime and no
  // model. This test pins that contract so a future signature change trips here.
  const args = createSequenceClock.length;
  assert.equal(args, 1, 'createSequenceClock takes exactly one options object');
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  const before = canvas.innerHTML;
  clock.seek(500);
  clock.seek(900);
  // Only class/style attributes may differ; no element was added or removed.
  assert.equal(canvas.querySelectorAll('[data-t-start]').length, 1);
  clock.destroy();
  assert.equal(canvas.innerHTML, before, 'destroy leaves the DOM exactly as found');
  canvas.remove();
});

// ── the conductor: media, timebase and the exits that must restore state ──────

/**
 * A <video> jsdom will never give us: a plain object with the members the conductor
 * touches, attached to a real element so `canvasEl.contains()` and `querySelector`
 * behave. `play`/`pause` are counters, `muted` is observable, and `duration` lets the
 * source-length clamp be exercised.
 */
function stubVideo(el: HTMLElement, duration = 30): {
  node: HTMLElement; pauses: number; plays: number; muted: boolean; currentTime: number;
} {
  const node = dom.window.document.createElement('video');
  const rec = { node, pauses: 0, plays: 0, muted: false, currentTime: 0, duration, seeks: [] as number[] };
  Object.defineProperties(node, {
    duration: { get: () => rec.duration, configurable: true },
    muted: { get: () => rec.muted, set: (v: boolean) => { rec.muted = v; }, configurable: true },
    currentTime: {
      get: () => rec.currentTime,
      set: (v: number) => { rec.currentTime = v; rec.seeks.push(v); },
      configurable: true,
    },
    playbackRate: { get: () => 1, set: () => { /* engine range */ }, configurable: true },
    play: { value: () => { rec.plays++; return Promise.resolve(); }, configurable: true },
    pause: { value: () => { rec.pauses++; }, configurable: true },
  });
  el.appendChild(node);
  return rec as never;
}

test('clock: a video orphaned by a canvas repaint is paused and un-muted, never left playing', () => {
  const { canvas, els } = stage(6000, [{ start: 0, dur: 6000 }]);
  const v = stubVideo(els[0]!);
  let wall = 0;
  // A holder rather than a bare `let`: TS narrows a variable only ever assigned
  // inside a callback to `never` at the call site.
  const frame: { cb: (() => void) | null } = { cb: null };
  const clock = createSequenceClock({
    canvasEl: canvas,
    raf: (cb) => { frame.cb = cb; return 1; },
    caf: () => { frame.cb = null; },
    now: () => wall,
  });
  clock.play();
  wall += 100;
  frame.cb?.();                       // one playing frame: the element is started + muted
  assert.equal(v.plays, 1, 'the clip is playing');
  assert.equal(v.pauses, 0);

  // Repaint the artboard out from under the clock, exactly as a tool re-render does.
  const art = canvas.querySelector('.artboard')!;
  art.innerHTML = '';
  art.appendChild(box({ start: 0, dur: 6000 }));
  clock.reapply();
  // Dropping the record without releasing left a DETACHED element playing its audio
  // until GC - one more overlapping soundtrack per repaint during playback.
  assert.equal(v.pauses, 1, 'the orphan was paused');
  assert.equal(v.muted, false, 'and its authored mute flag restored');
  clock.destroy();
  canvas.remove();
});

test('clock: a clip trimmed longer than its source holds the last frame, no seek storm', () => {
  const { canvas, els } = stage(10_000, [{ start: 0, dur: 10_000 }]);
  const v = stubVideo(els[0]!, 3);           // a 3s file under a 10s clip
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  clock.seek(1000);
  const upTo3s = (v as unknown as { seeks: number[] }).seeks.length;
  for (const t of [4000, 5000, 6000, 7000, 8000]) clock.seek(t);
  const seeks = (v as unknown as { seeks: number[] }).seeks;
  for (const t of seeks) assert.ok(t <= 3, `never seeks past the source end, got ${t}`);
  assert.ok(seeks.length - upTo3s <= 1, `past the end the target stops moving: ${seeks.length - upTo3s} extra seeks`);
  clock.destroy();
  canvas.remove();
});

test('clock: play() is a no-op when nothing is timed, so the playhead cannot run away', () => {
  const canvas = dom.window.document.createElement('div');
  const art = dom.window.document.createElement('div');
  art.className = 'artboard';
  canvas.appendChild(art);
  dom.window.document.body.appendChild(canvas);
  let frames = 0;
  const clock = createSequenceClock({ canvasEl: canvas, raf: (cb) => { frames++; void cb; return 1; }, caf: () => { /* held */ } });
  assert.equal(clock.duration(), 0);
  clock.play();
  assert.equal(clock.playing(), false, 'no duration, no playback');
  assert.equal(clock.t(), 0);
  assert.equal(frames, 0, 'and no rAF loop burning a full apply pass per frame');
  clock.destroy();
  canvas.remove();
});

test('clock: playback advances by REAL elapsed time, not a fixed 16ms per frame', () => {
  // The old fallback added 16ms per tick, so the sequence played at 2x on a 120Hz
  // display and in slow motion under load. jsdom has no AudioContext, which is
  // exactly the branch this pins.
  const { canvas } = stage(6000, [{ start: 0, dur: 6000 }]);
  let wall = 1000;
  // A holder rather than a bare `let`: TS narrows a variable only ever assigned
  // inside a callback to `never` at the call site.
  const frame: { cb: (() => void) | null } = { cb: null };
  const clock = createSequenceClock({
    canvasEl: canvas,
    raf: (cb) => { frame.cb = cb; return 1; },
    caf: () => { frame.cb = null; },
    now: () => wall,
  });
  clock.play();
  assert.equal(clock.playing(), true);
  wall += 500;                       // half a second of wall time, one frame
  frame.cb?.();
  assert.ok(Math.abs(clock.t() - 500) < 1, `advanced by real elapsed time, got ${clock.t()}`);
  wall += 250;
  frame.cb?.();
  assert.ok(Math.abs(clock.t() - 750) < 1, `and again, got ${clock.t()}`);
  // Past the end it holds and pauses, the editor convention.
  wall += 10_000;
  frame.cb?.();
  assert.equal(clock.t(), 6000);
  assert.equal(clock.playing(), false);
  clock.destroy();
  canvas.remove();
});

test('seek queue: a stale landing never nudges past a NEWER in-flight seek', async () => {
  // The pump shifts the next job off SYNCHRONOUSLY when one resolves, so by the time
  // the stale `.then` runs, `pending()` is 0 and the newer seek is already in flight.
  // Only the generation check catches this; the symptom was the element finishing on
  // the scrub's frame while the playhead read the pointer-up position.
  const v = mockVideo();
  let clock = 0;
  const seeker = createVideoSeeker(v.el, { waitFrame: v.waitFrame, now: () => clock });
  seeker.request(5);                       // in flight
  clock += 1000;
  seeker.request(20);                      // authoritative, queued behind it
  assert.equal(v.calls.length, 1);
  v.calls[0]!.d.resolve(4.0);              // lands a full second short - would earn a nudge
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(seeker.nudges(), 0, 'no nudge toward the stale target');
  assert.deepEqual(v.calls.map((c) => c.t), [5, 20], 'only the two real seeks were issued');
  seeker.destroy();
});

// ── preview audio ───────────────────────────────────────────────────────────
//
// What a headless test can honestly pin is the SCHEDULING DECISION: which sources are
// created at all, and the (when, offset, duration) triple each one is handed. That
// triple is the whole contract with the audio thread - get it right and the sound is
// sample-accurate by construction; get it wrong and no amount of frame-loop cleverness
// recovers it. Everything below therefore asserts on those three numbers, on which
// boxes are refused, and on what is left running after each exit from playback.
//
// What CANNOT be verified here (browser only): that audible sound reaches the output
// device, autoplay-policy behaviour of a real `resume()`, and real decodeAudioData.

interface FakeSource {
  buffer: unknown;
  onended: (() => void) | null;
  started: { when: number; offset: number; dur: number } | null;
  stops: number;
  disconnects: number;
  connectedTo: unknown;
  connect(dest: unknown): void;
  disconnect(): void;
  start(when: number, offset: number, dur: number): void;
  stop(): void;
}

function fakeAudioCtx() {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: { name: 'destination' },
    createBufferSource(): FakeSource {
      const s: FakeSource = {
        buffer: null, onended: null, started: null, stops: 0, disconnects: 0, connectedTo: null,
        connect(dest) { s.connectedTo = dest; },
        disconnect() { s.disconnects++; },
        start(when, offset, dur) { s.started = { when, offset, dur }; },
        stop() { s.stops++; },
      };
      sources.push(s);
      return s;
    },
    resume() { return Promise.resolve(); },
    suspend() { return Promise.resolve(); },
    close() { return Promise.resolve(); },
  };
  return { ctx, sources, live: (): FakeSource[] => sources.filter((s) => s.started && !s.stops) };
}

/** A decoded track: 97 s stereo at 48k - the catalog's loops, which is the point. */
const fakeBuffer = (durationSec = 97): AudioBuffer => ({
  duration: durationSec,
  length: Math.round(durationSec * 48_000),
  numberOfChannels: 2,
  sampleRate: 48_000,
} as unknown as AudioBuffer);

/** Install a fake AudioContext for the duration of one test. */
function withAudioCtx<T>(fn: (a: ReturnType<typeof fakeAudioCtx>) => T): T {
  const a = fakeAudioCtx();
  const g = globalThis as Record<string, unknown>;
  const had = Object.hasOwn(g, 'AudioContext');
  const prev = g.AudioContext;
  g.AudioContext = function AudioContextStub() { return a.ctx; };
  try {
    return fn(a);
  } finally {
    if (had) g.AudioContext = prev; else delete g.AudioContext;
  }
}

/** rAF seam that queues, so a frame runs exactly when the test says so. */
function frameQueue() {
  const q: (() => void)[] = [];
  return {
    raf: (cb: () => void): number => q.push(cb),
    caf: (h: number): void => { q[h - 1] = (): void => { /* cancelled */ }; },
    /** Run the frames pending right now (a callback that reschedules waits its turn). */
    flush(): void { for (const cb of q.splice(0)) cb(); },
    pending: (): number => q.length,
  };
}

const settle = (): Promise<void> => new Promise((r) => { setImmediate(r); });

/** Log capture, so "degrades with a warning" is a real assertion. */
function logs(): { host: { log(l: string, m: string): void }; lines: string[] } {
  const lines: string[] = [];
  return { host: { log: (l, m) => { lines.push(`${l}: ${m}`); } }, lines };
}

test('audio: a box is scheduled once, at when = t0 + start, offset = clipIn, for its own length', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 2000, dur: 3000, clipIn: 1500, audio: true }]);
    const q = frameQueue();
    const loads: string[] = [];
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async (url) => { loads.push(url); return fakeBuffer(); },
    });
    clock.play();
    await settle();
    assert.deepEqual(loads, ['bed.ogg'], 'the marker\'s src was decoded exactly once');
    assert.equal(a.sources.length, 1);
    // t0 = 0 (ctx.currentTime 0, playhead 0), so the clip's own start IS the when:
    // the source is handed to the audio thread 2 s AHEAD of the moment it sounds,
    // which is what makes it sample-accurate rather than frame-accurate.
    assert.deepEqual(a.sources[0]!.started, { when: 2, offset: 1.5, dur: 3 });
    assert.equal(a.sources[0]!.connectedTo, a.ctx.destination);
    clock.destroy();
    canvas.remove();
  });
});

test('audio: playing from inside a box starts it NOW, with the elapsed part skipped', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 1000, dur: 4000, clipIn: 500, audio: true }]);
    const q = frameQueue();
    a.ctx.currentTime = 10;                     // a context that has been alive a while
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.seek(2500);                            // start playback from the middle
    q.flush();
    clock.play();
    await settle();
    // t0 = 10 - 2.5 = 7.5; the box began 1.5 s ago, so the source starts immediately
    // (when = ctx.currentTime) 1.5 s further into the file than its in-point.
    // …and for what is LEFT of the window: the clip ends at 5 s, the playhead is at 2.5 s.
    assert.deepEqual(a.sources[0]!.started, { when: 10, offset: 0.5 + 1.5, dur: 2.5 });
    clock.destroy();
    canvas.remove();
  });
});

test('audio: the scheduled span is clipped to the source, the box and the sequence', async () => {
  await withAudioCtx(async (a) => {
    // A 3 s file under a 10 s clip that itself overruns a 6 s sequence.
    const { canvas } = stage(6000, [{ start: 1000, dur: 10_000, clipIn: 1000, audio: true }]);
    const q = frameQueue();
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(3),
    });
    clock.play();
    await settle();
    // Window says 5 s of room (6 s sequence − 1 s start); the file has only 2 s left
    // past its 1 s in-point, and that is the smaller of the two.
    assert.deepEqual(a.sources[0]!.started, { when: 1, offset: 1, dur: 2 });
    clock.destroy();
    canvas.remove();
  });
});

test('audio: a muted box schedules nothing at all - no fetch, no source', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(6000, [{ start: 0, dur: 4000, mute: true, audio: true }]);
    const q = frameQueue();
    let loads = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => { loads++; return fakeBuffer(); },
    });
    clock.play();
    await settle();
    assert.equal(loads, 0, 'a muted clip is never even fetched');
    assert.equal(a.sources.length, 0);
    clock.destroy();
    canvas.remove();
  });
});

test('audio: un-muting mid-playback places the box; muting again silences it', async () => {
  await withAudioCtx(async (a) => {
    const { canvas, els } = stage(6000, [{ start: 0, dur: 6000, mute: true, audio: true }]);
    const q = frameQueue();
    let wall = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => wall,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    assert.equal(a.sources.length, 0);
    // The panel's speaker button writes the model, the hook re-stamps the attribute.
    els[0]!.removeAttribute('data-t-mute');
    wall += 16; a.ctx.currentTime = 0.016;
    q.flush();                                   // one playback frame
    await settle();
    assert.equal(a.live().length, 1, 'the un-muted clip now sounds');
    els[0]!.setAttribute('data-t-mute', '1');
    wall += 16; a.ctx.currentTime = 0.032;
    q.flush();
    await settle();
    assert.equal(a.live().length, 0, 'and muting it again stops the source');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: a clip at speed !== 1 attempts the stretch bounce and degrades to silence gracefully', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(6000, [{ start: 0, dur: 4000, speed: 2, audio: true }]);
    const q = frameQueue();
    const L = logs();
    const clock = createSequenceClock({
      canvasEl: canvas, host: L.host, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    // WP-7 (plans/165): sped clips BOUNCE through the pitch-preserving stretcher
    // instead of going silent. The harness's fake buffer has no channel data to
    // read, so the bounce fails and the clip degrades to silence with ONE visible
    // reason - never a rejection into the frame loop. (The real-buffer math is
    // proven by the stretch goldens; jsdom has no AudioBuffer to bounce into.)
    assert.equal(a.sources.length, 0);
    assert.ok(L.lines.some((l) => l.includes('stretch bounce failed')), `warned: ${L.lines.join(' / ')}`);
    clock.destroy();
    canvas.remove();
  });
});

test('audio: pause stops every source, and resuming re-places it at the held playhead', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 0, dur: 8000, audio: true }]);
    const q = frameQueue();
    let wall = 0;
    let loads = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => wall,
      loadAudio: async () => { loads++; return fakeBuffer(); },
    });
    clock.play();
    await settle();
    assert.equal(a.sources.length, 1);
    // Two seconds of playback, then Space.
    wall += 2000; a.ctx.currentTime = 2;
    q.flush();
    clock.pause();
    assert.equal(a.sources[0]!.stops, 1, 'the source was stopped, not left running');
    assert.equal(a.live().length, 0);
    // Resume: the playhead is at 2 s, so the source restarts 2 s into the track - and
    // the decode is NOT repeated, the buffer is cached for the life of the clock.
    clock.play();
    await settle();
    assert.equal(loads, 1, 'no refetch on resume');
    assert.equal(a.sources.length, 2);
    assert.deepEqual(a.sources[1]!.started, { when: 2, offset: 2, dur: 6 });
    clock.destroy();
    canvas.remove();
  });
});

test('audio: seeking while playing re-places every source against the new playhead', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(10_000, [{ start: 2000, dur: 6000, clipIn: 1000, audio: true }]);
    const q = frameQueue();
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    assert.deepEqual(a.sources[0]!.started, { when: 2, offset: 1, dur: 6 });
    a.ctx.currentTime = 1;                       // a second of real playback
    clock.seek(5000);                            // scrub into the middle of the clip
    q.flush();
    await settle();
    assert.equal(a.sources[0]!.stops, 1, 'the stale placement was stopped');
    assert.equal(a.sources.length, 2);
    // t0 = 1 − 5 = −4; the playhead is 3 s into the clip, so it starts immediately,
    // 3 s past the in-point, with the remaining 3 s of the window.
    assert.deepEqual(a.sources[1]!.started, { when: 1, offset: 4, dur: 3 });
    clock.destroy();
    canvas.remove();
  });
});

test('audio: seeking PAST a box silences it; seeking back places it again', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(10_000, [{ start: 1000, dur: 2000, audio: true }]);
    const q = frameQueue();
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    assert.equal(a.live().length, 1);
    a.ctx.currentTime = 0.5;
    clock.seek(7000);                            // well past the box's 3 s end
    q.flush();
    await settle();
    assert.equal(a.live().length, 0, 'nothing sounds past the clip');
    assert.equal(a.sources.length, 1, 'and no pointless second source was created');
    clock.seek(1500);                            // back into it
    q.flush();
    await settle();
    assert.equal(a.sources.length, 2);
    assert.deepEqual(a.sources[1]!.started, { when: 0.5, offset: 0.5, dur: 1.5 });
    clock.destroy();
    canvas.remove();
  });
});

test('audio: seeking while PAUSED never makes a sound', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 0, dur: 8000, audio: true }]);
    const q = frameQueue();
    let loads = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => { loads++; return fakeBuffer(); },
    });
    for (const t of [500, 1500, 2500, 3500]) { clock.seek(t, { scrubbing: true }); q.flush(); }
    await settle();
    assert.equal(loads, 0, 'a scrub decodes nothing');
    assert.equal(a.sources.length, 0, 'and starts nothing');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: reaching the end of the sequence stops the mix', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(3000, [{ start: 0, dur: 3000, audio: true }]);
    const q = frameQueue();
    let wall = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => wall,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    assert.equal(a.live().length, 1);
    wall += 4000; a.ctx.currentTime = 4;
    q.flush();                                   // the frame that runs off the end
    assert.equal(clock.playing(), false);
    assert.equal(a.live().length, 0, 'the end of the sequence is silence, not a lingering track');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: a box orphaned by a repaint is stopped, and the fresh one placed once', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 0, dur: 8000, audio: true }]);
    const q = frameQueue();
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    await settle();
    const first = a.sources[0]!;
    const art = canvas.querySelector('.artboard')!;
    art.innerHTML = '';
    art.appendChild(box({ start: 0, dur: 8000, audio: true }));
    clock.reapply();
    await settle();
    assert.equal(first.stops, 1, 'the detached box stopped playing - no overlapping copy');
    assert.equal(a.live().length, 1, 'exactly one track is sounding');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: destroy stops every source, aborts the in-flight fetch and drops the buffers', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [
      { start: 0, dur: 8000, audio: 'one.ogg' },
      { start: 0, dur: 8000, audio: 'two.mp3' },
    ]);
    const q = frameQueue();
    const seen: AbortSignal[] = [];
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: (url, signal) => {
        seen.push(signal);
        // one.ogg lands; two.mp3 never does - a slow CDN at the moment of teardown.
        return url === 'one.ogg' ? Promise.resolve(fakeBuffer()) : new Promise(() => { /* never */ });
      },
    });
    clock.play();
    await settle();
    assert.equal(a.live().length, 1);
    clock.destroy();
    await settle();
    assert.equal(a.live().length, 0, 'nothing is left playing after destroy');
    assert.equal(a.sources[0]!.stops, 1);
    assert.ok(seen.some((s) => s.aborted), 'the fetch still in flight was aborted');
    // And the DOM is handed back exactly as found, audio marker included.
    assert.equal(canvas.querySelectorAll(`.${OFF_CLASS}`).length, 0);
    canvas.remove();
  });
});

test('audio: a decode failure degrades to silence with a warning, and is never retried', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, [{ start: 0, dur: 8000, audio: true }]);
    const q = frameQueue();
    const L = logs();
    let loads = 0;
    let wall = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, host: L.host, raf: q.raf, caf: q.caf, now: () => wall,
      loadAudio: async () => { loads++; throw new Error('unsupported container'); },
    });
    clock.play();
    await settle();
    assert.equal(a.sources.length, 0, 'silent');
    assert.equal(clock.playing(), true, 'and the picture keeps playing');
    assert.ok(L.lines.some((l) => l.startsWith('warn:') && l.includes('unsupported container')), L.lines.join(' / '));
    // Every subsequent frame must NOT re-attempt the fetch.
    for (let i = 0; i < 3; i++) { wall += 16; a.ctx.currentTime += 0.016; q.flush(); await settle(); }
    clock.pause();
    clock.play();
    await settle();
    assert.equal(loads, 1, 'a failed source is asked for exactly once per clock');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: the distinct-source ceiling is enforced, and the overflow degrades with a log', async () => {
  await withAudioCtx(async (a) => {
    const n = MAX_PREVIEW_AUDIO_SOURCES + 2;
    const specs: BoxSpec[] = [];
    for (let i = 0; i < n; i++) specs.push({ start: 0, dur: 8000, audio: `track-${i}.ogg` });
    const { canvas } = stage(8000, specs);
    const q = frameQueue();
    const L = logs();
    let loads = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, host: L.host, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => { loads++; return fakeBuffer(); },
    });
    clock.play();
    await settle();
    assert.equal(loads, MAX_PREVIEW_AUDIO_SOURCES, 'decoded PCM is bounded by the ceiling, not by the composition');
    assert.equal(a.live().length, MAX_PREVIEW_AUDIO_SOURCES);
    assert.ok(L.lines.some((l) => l.includes('distinct tracks')), L.lines.join(' / '));
    clock.destroy();
    canvas.remove();
  });
});

test('audio: boxes sharing one source decode once and both sound', async () => {
  await withAudioCtx(async (a) => {
    const { canvas } = stage(10_000, [
      { start: 0, dur: 3000, audio: 'sting.ogg' },
      { start: 5000, dur: 3000, audio: 'sting.ogg' },
    ]);
    const q = frameQueue();
    let loads = 0;
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => { loads++; return fakeBuffer(); },
    });
    clock.play();
    await settle();
    assert.equal(loads, 1, 'one decode for one URL');
    assert.deepEqual(a.sources.map((s) => s.started?.when), [0, 5], 'both placements, each at its own start');
    clock.destroy();
    canvas.remove();
  });
});

test('audio: with no AudioContext at all the clock plays picture and stays silent', async () => {
  const { canvas } = stage(6000, [{ start: 0, dur: 6000, audio: true }]);
  const q = frameQueue();
  const L = logs();
  let loads = 0;
  const clock = createSequenceClock({
    canvasEl: canvas, host: L.host, raf: q.raf, caf: q.caf, now: () => 0,
    loadAudio: async () => { loads++; return fakeBuffer(); },
  });
  clock.play();
  await settle();
  assert.equal(clock.playing(), true);
  assert.equal(loads, 0, 'nothing to play it through, so nothing is fetched');
  assert.ok(L.lines.some((l) => l.includes('no AudioContext')), L.lines.join(' / '));
  clock.destroy();
  canvas.remove();
});

// ── tracker modules in the preview mix ──────────────────────────────────────
//
// A .mod/.xm/.it/… holds a score, not encoded audio, so `decodeAudioData` throws on
// one and the box was silent. What is provable here: the recogniser (extension AND
// bytes, because an uploaded module is a `blob:` url with neither an extension nor an
// honest MIME type), that a recognised source is routed to libopenmpt instead of the
// platform decoder, that it then rides the ORDINARY cache/abort/ceiling plumbing, and
// that a failed render is a logged silence.
//
// ONLY A REAL BROWSER CAN PROVE that a .mod is audible: the libopenmpt WASM worker is
// stubbed through the `renderModule` seam, and jsdom has no audio output at all.

test('module detection: the extension is a fast path, and only on the PATH', () => {
  assert.equal(urlExtension('https://x.test/song.MOD?v=2#t'), 'mod', 'case and query are not part of it');
  assert.equal(urlExtension('blob:https://lolly.tools/6f1c-77a2'), '', 'an upload has no extension at all');
  assert.equal(urlExtension('https://x.test/track.ogg?src=other.mod'), 'ogg', 'a query is never the extension');
  assert.equal(isModuleUrl('https://x.test/track.ogg?src=other.mod'), false);
  for (const ext of MODULE_EXTENSIONS) assert.equal(isModuleUrl(`a/b/tune.${ext}`), true, ext);
  assert.equal(isModuleUrl('bed.ogg'), false);
});

test('module detection: MODULE_EXTENSIONS has not drifted from the shipped renderer', async () => {
  // Imported HERE and nowhere in the shipped module: lib/mod-render.ts owns the list
  // (libopenmpt is what actually decodes them), but importing it eagerly would drag
  // the worker chunk onto the first-paint path. So the copy is guarded instead.
  const { MODULE_FORMATS } = await import('../lib/mod-render.ts');
  assert.deepEqual([...MODULE_EXTENSIONS].sort(), [...MODULE_FORMATS].sort());
});

/** An IT header - the shortest honest module fixture. */
const itBytes = (): Uint8Array => {
  const b = new Uint8Array(64);
  for (const [i, c] of [...'IMPM'].entries()) b[i] = c.charCodeAt(0);
  return b;
};

test('module detection: bytes decide when the url cannot', () => {
  assert.equal(sniffTrackerModule(itBytes()), true);
  assert.equal(sniffTrackerModule(itBytes().buffer as ArrayBuffer), true, 'an ArrayBuffer is accepted too');
  assert.equal(looksLikeTrackerModule('blob:https://lolly.tools/6f1c', itBytes()), true);
  assert.equal(looksLikeTrackerModule('blob:https://lolly.tools/6f1c', new Uint8Array(64)), false);
  assert.equal(looksLikeTrackerModule('tune.xm', null), true, 'the name alone is enough');
});

/** A fetch stub returning `bytes` for every request. Restores the previous global. */
function withFetch<T>(bytes: Uint8Array, fn: (calls: string[]) => T): T {
  const g = globalThis as Record<string, unknown>;
  const had = Object.hasOwn(g, 'fetch');
  const prev = g.fetch;
  const calls: string[] = [];
  g.fetch = (url: string) => {
    calls.push(url);
    return Promise.resolve({
      ok: true,
      headers: { get: () => String(bytes.byteLength) },
      // No `body`: readBounded falls back to arrayBuffer(), its documented path for a
      // polyfilled fetch. The copy matters - the renderer transfers what it is given.
      arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
    });
  };
  try {
    return fn(calls);
  } finally {
    if (had) g.fetch = prev; else delete g.fetch;
  }
}

test('audio: a tracker module is rendered by libopenmpt, never handed to decodeAudioData', async () => {
  await withAudioCtx(async (a) => {
    await withFetch(itBytes(), async () => {
      let decodes = 0;
      const ctxAny = a.ctx as unknown as Record<string, unknown>;
      ctxAny.sampleRate = 48_000;
      ctxAny.decodeAudioData = (): Promise<AudioBuffer> => {
        decodes++;
        return Promise.reject(new Error('EncodingError'));
      };
      const { canvas } = stage(8000, [{ start: 1000, dur: 3000, clipIn: 500, audio: 'blob:https://lolly.tools/6f1c' }]);
      const q = frameQueue();
      const rendered: { rate: number; bytes: number }[] = [];
      const clock = createSequenceClock({
        canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
        renderModule: async (ctx, bytes) => {
          rendered.push({ rate: (ctx as { sampleRate?: number }).sampleRate ?? 0, bytes: bytes.length });
          return fakeBuffer(30);
        },
      });
      clock.play();
      await settle();
      assert.equal(decodes, 0, 'a module must never reach the platform decoder');
      assert.deepEqual(rendered, [{ rate: 48_000, bytes: 64 }], 'libopenmpt got the bytes, at the context rate');
      // And it is then an ordinary source: same scheduling triple as a decoded file.
      assert.deepEqual(a.sources[0]?.started, { when: 1, offset: 0.5, dur: 3 });
      clock.destroy();
      canvas.remove();
    });
  });
});

test('audio: a module is fetched once and shared, through the ordinary decode cache', async () => {
  await withAudioCtx(async (a) => {
    await withFetch(itBytes(), async (calls) => {
      const { canvas } = stage(9000, [
        { start: 0, dur: 3000, audio: 'blob:https://lolly.tools/tune' },
        { start: 5000, dur: 3000, audio: 'blob:https://lolly.tools/tune' },
      ]);
      const q = frameQueue();
      const clock = createSequenceClock({
        canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
        renderModule: async (_ctx, bytes) => {
          assert.equal(bytes.length, 64, 'the sniffed bytes reach the renderer unchanged');
          return fakeBuffer(30);
        },
      });
      // The default loader is in play here, so this exercises the real fetch → sniff →
      // render path, including the shared byte ceiling and the AbortController.
      clock.play();
      await settle();
      assert.deepEqual(calls, ['blob:https://lolly.tools/tune'], 'one fetch for a source two boxes share');
      assert.equal(a.sources.length, 2, 'both boxes are placed from the one decode');
      clock.destroy();
      canvas.remove();
    });
  });
});

test('audio: a module libopenmpt refuses is a logged silence, and is never retried', async () => {
  await withAudioCtx(async (a) => {
    await withFetch(itBytes(), async (calls) => {
      const { canvas } = stage(6000, [{ start: 0, dur: 6000, audio: 'blob:https://lolly.tools/broken' }]);
      const q = frameQueue();
      const L = logs();
      let renders = 0;
      const clock = createSequenceClock({
        canvasEl: canvas, host: L.host, raf: q.raf, caf: q.caf, now: () => 0,
        renderModule: async () => { renders++; throw new Error('not a recognized tracker module'); },
      });
      clock.play();
      await settle();
      q.flush();
      await settle();
      assert.equal(a.sources.length, 0, 'nothing is scheduled');
      assert.equal(clock.playing(), true, 'the picture keeps playing');
      assert.equal(renders, 1, 'a refused source is remembered, not re-attempted every frame');
      assert.equal(calls.length, 1);
      assert.ok(
        L.lines.some((l) => l.includes('blob:https://lolly.tools/broken') && l.includes('tracker module')),
        `the box and the reason must both be named: ${L.lines.join(' / ')}`,
      );
      clock.destroy();
      canvas.remove();
    });
  });
});

test('audio: a non-module source still goes to decodeAudioData', async () => {
  await withAudioCtx(async (a) => {
    await withFetch(new Uint8Array(64), async () => {
      let decoded = 0;
      (a.ctx as unknown as Record<string, unknown>).decodeAudioData = (): Promise<AudioBuffer> => {
        decoded++;
        return Promise.resolve(fakeBuffer(10));
      };
      const { canvas } = stage(4000, [{ start: 0, dur: 4000, audio: 'https://x.test/bed.ogg' }]);
      const q = frameQueue();
      const clock = createSequenceClock({
        canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
        renderModule: async () => { throw new Error('must never be called for an ogg'); },
      });
      clock.play();
      await settle();
      assert.equal(decoded, 1, 'the platform decoder still owns real containers');
      assert.equal(a.sources.length, 1);
      clock.destroy();
      canvas.remove();
    });
  });
});

// ── the export-time read/restore seam (plans/104 section 6 point 0) ───────────────
//
// The clock is the writer that seam exists for: an export parses and photographs the
// very elements it has been composing transform/opacity/filter/z-index onto, and the
// playhead can be parked anywhere when the user presses Export.

const { withAuthoredDom, authoredStyleOf } = await import('../bridge/sequence-dom.ts');

test('seam: withAuthoredDom stands the clock down, and hands the frame back afterwards', async () => {
  const { canvas, els } = stage(4000, [{ start: 0, dur: 4000, enter: 'fade', enterMs: 2000, style: 'opacity:0.6;' }]);
  // A REAL frame queue rather than `syncRaf`: this test seeks twice, and the sync seam
  // leaves `frame` non-zero after its first callback (it resets it before the assignment
  // lands), so every later `schedule()` short-circuits.
  const q = frameQueue();
  const clock = createSequenceClock({ canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0 });
  clock.seek(1000);                                   // mid-fade: the box IS composed
  q.flush();
  const el = els[0] as HTMLElement;
  const posed = el.style.opacity;
  assert.notEqual(posed, '', 'the clock really did compose an opacity');
  assert.notEqual(posed, '0.6', 'and it is not the authored one');

  const inside = await withAuthoredDom(canvas, async () => {
    // A rAF tick landing mid-export must not re-pose the stage between two plate
    // shots - the whole reason the pause is a flag rather than a one-off restore.
    // (400 rather than a later time on purpose: `recTransition`'s fade reaches full
    // alpha before its window ends, so a "mid-fade" t too near the end is at rest and
    // would compose the authored value back - a passing assertion that proved nothing.)
    clock.seek(400);
    q.flush();
    await Promise.resolve();
    return el.style.opacity;
  });
  assert.equal(inside, '0.6', 'the authored opacity, for the whole scope');
  assert.notEqual(el.style.opacity, '0.6', 'and the playhead is re-asserted on the way out');
  assert.notEqual(el.style.opacity, posed, 'at t = 400, where the clock got to - not 1000');
  assert.equal(clock.t(), 400, 'the time it reached while it was held');
  clock.destroy();
  canvas.remove();
});

test('seam: a destroyed clock deregisters - nothing answers authored reads for it', async () => {
  const { canvas, els } = stage(4000, [{ start: 0, dur: 4000, enter: 'fade', enterMs: 2000, style: 'opacity:0.6;' }]);
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  clock.seek(1000);
  const el = els[0] as HTMLElement;
  assert.equal(authoredStyleOf(el)?.opacity, '0.6', 'the live clock claims the box');
  clock.destroy();
  assert.equal(authoredStyleOf(el), null, 'and lets go of it with its last write');
  // The scope over a canvas nobody is writing to is transparent, down to the style.
  const before = el.getAttribute('style');
  await withAuthoredDom(canvas, () => undefined);
  assert.equal(el.getAttribute('style'), before);
  canvas.remove();
});

test('seam: a clean composition is never written to, so the scope has nothing to undo', async () => {
  // The byte-identity floor: no transition, no depth - the applier composes nothing,
  // the registry answers null, and an export sees the document it always saw.
  const { canvas, els } = stage(4000, [{ start: 0, dur: 4000, style: 'opacity:0.6;' }]);
  const clock = createSequenceClock({ canvasEl: canvas, ...syncRaf });
  const el = els[0] as HTMLElement;
  const before = el.getAttribute('style');
  clock.seek(1000);
  assert.equal(el.getAttribute('style'), before, 'not one declaration rewritten');
  assert.equal(authoredStyleOf(el), null, 'nothing composed: nothing claimed');
  await withAuthoredDom(canvas, () => {
    assert.equal(el.getAttribute('style'), before);
  });
  assert.equal(el.getAttribute('style'), before);
  clock.destroy();
  canvas.remove();
});

test('audio: a narration box inside a timed slide page sounds ONCE - the page does not place it again', async () => {
  // Frames document: the slide page is a [data-t-start] host and so is the narration
  // box it holds. Both are driven; only the box may claim the marker (Andy, 2026-09-03:
  // every narrated slide spoke in two voices).
  await withAudioCtx(async (a) => {
    const { canvas } = stage(8000, []);
    const art = canvas.querySelector('.artboard')!;
    const page = dom.window.document.createElement('div');
    page.className = 'lolly-frame-page';
    page.setAttribute('data-pdf-page', '');
    page.setAttribute('data-t-start', '0');
    page.setAttribute('data-t-dur', '8000');
    page.appendChild(box({ start: 400, dur: 5000, audio: 'narration.wav', lane: 'seq' }));
    art.appendChild(page);
    const q = frameQueue();
    const clock = createSequenceClock({
      canvasEl: canvas, raf: q.raf, caf: q.caf, now: () => 0,
      loadAudio: async () => fakeBuffer(),
    });
    clock.play();
    clock.seek(1000);
    await settle();
    assert.equal(a.live().length, 1, 'one voice: the box placed the clip, the page did not');
    clock.destroy();
    canvas.remove();
  });
});
