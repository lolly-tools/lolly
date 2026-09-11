// SPDX-License-Identifier: MPL-2.0
/**
 * The catalog's inline video Grade/Trim mode (plans/130, S4).
 *
 * What is worth pinning here is everything the catalog side can't be tested for
 * (no test mounts the 5k-line catalog view):
 *   - the mode offers ALL THREE tabs over one stage, and the tab decides the request;
 *   - the crop box is a fraction model (the drag itself is out of jsdom's reach),
 *     opening 60% centred and converting to even source pixels on Apply;
 *   - a window set on the trim tab RIDES ALONG on a crop or a grade - `range` is a
 *     request-level field, so one job does both;
 *   - the trim refusal is recomputed against the SELECTED WINDOW, so a source
 *     that is too long as a whole becomes acceptable once in/out fit - the whole
 *     reason a trim UI may accept a clip the job would otherwise refuse;
 *   - Apply builds the documented request shape (trim and grade both carry
 *     fps 0 = "source rate"; grade maps its percent sliders back to 0..1);
 *   - Apply REFUSES a trim that trims nothing: the tab opens on the whole clip,
 *     and encoding that would hand back a lossy copy carrying a credential that
 *     says it was trimmed;
 *   - a released edge drag applies its release position even when the gesture was
 *     over before a frame painted;
 *   - exit() restores the ORIGINAL preview's playback and is idempotent;
 *   - busy() covers the beat between the Apply click and the enqueue, so a
 *     second click (or an Escape) can't enqueue the same job twice.
 *
 * video-jobs.ts is stubbed: a spy for runVideoJobAsJob (no encoder in jsdom) and
 * faithful mini copies of videoJobRefusal (window-vs-cap) and roundCropRect (the
 * even-dimension snap), so the assertions are about THIS module's calls and
 * reactions, not the cap's or the snap's arithmetic - which
 * lib/video-jobs' own suite owns. The engine's grade maths is stubbed for the
 * same reason: jsdom has no 2-D canvas, so the live preview can never paint here.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/video-edit-inline.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url.endsWith('/lib/video-jobs.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `
          export const VIDEO_JOB_MAX_DURATION_SEC = 120;
          export function videoJobRefusal(op, probe, range) {
            const dur = range ? Math.max(0, range.endSec - range.startSec) : probe.durationSec;
            (globalThis.__refusalCalls ??= []).push({ op, probe, range });
            return dur > 120 ? 'This clip is too long (the ceiling is 120 seconds).' : null;
          }
          export function runVideoJobAsJob(host, req, hooks) {
            (globalThis.__vjobs ??= []).push({ req, hooks });
            return { finish() {}, cancel() {} };
          }
          export function evenFloor(n) { const v = Math.floor(n / 2) * 2; return v < 2 ? 2 : v; }
          export function roundCropRect(rect, srcW, srcH) {
            let x = Math.max(0, Math.min(Math.floor(rect.x), Math.max(0, srcW - 2)));
            let y = Math.max(0, Math.min(Math.floor(rect.y), Math.max(0, srcH - 2)));
            x -= x % 2; y -= y % 2;
            return { x, y, w: evenFloor(Math.min(rect.w, srcW - x)), h: evenFloor(Math.min(rect.h, srcH - y)) };
          }`,
      };
    }
    if (url.endsWith('/engine/src/index.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `
          export function parseLutText(text) {
            if (!/LUT_3D_SIZE/.test(text)) throw new Error('not a LUT');
            return { kind: '3d', size: 2, data: new Float32Array(24), domainMin: [0,0,0], domainMax: [1,1,1], title: '' };
          }
          export function applyLutFrame() {}
          export function applyGrainVignette() {}
          export const GRAIN_REF_LONG_EDGE = 1080;
          export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }`,
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; Event: typeof Event };
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement',
  'HTMLCanvasElement', 'HTMLVideoElement', 'HTMLMediaElement', 'Element', 'Node', 'Event', 'CustomEvent',
  'MouseEvent', 'KeyboardEvent', 'FileReader', 'AbortController',
]) {
  const v = (dom.window as unknown as Record<string, unknown>)[k];
  if (v !== undefined) (globalThis as Record<string, unknown>)[k] = v;
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;

// jsdom has no media pipeline: the metrics the mode reads (duration, pixel size,
// the playhead) are properties, and the transport calls are no-ops. Stub them on
// the prototypes so the module runs its REAL code paths against a fake source.
let srcDuration = 10;
const media = dom.window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
const videoProto = dom.window.HTMLVideoElement.prototype as unknown as Record<string, unknown>;
Object.defineProperty(media, 'duration', { configurable: true, get() { return srcDuration; } });
Object.defineProperty(media, 'currentTime', {
  configurable: true,
  get(this: Record<string, unknown>) { return (this.__t as number) ?? 0; },
  set(this: Record<string, unknown>, v: number) { this.__t = v; },
});
Object.defineProperty(videoProto, 'videoWidth', { configurable: true, get() { return 1280; } });
Object.defineProperty(videoProto, 'videoHeight', { configurable: true, get() { return 720; } });
media.play = function play() { return Promise.resolve(); };
// jsdom's `paused` is true from birth, so counting the calls is the only way to
// see that the mode actually stood the hidden, autoplaying preview down.
media.pause = function pause(this: Record<string, unknown>) { this.__pauseCalls = ((this.__pauseCalls as number) ?? 0) + 1; };
media.load = function load() { /* no media pipeline in jsdom */ };
// jsdom's own getContext raises a not-implemented error on the virtual console;
// null is what a context-less canvas actually hands back, and the mode's
// no-context bail is the path this suite runs through.
(dom.window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext = function getContext() { return null; };

const {
  mountInlineVideoEdit, cropRectFromFrac, dragCropFrac, DEFAULT_CROP_FRAC,
  dragTrimEdge, parseTimeText, trimEdgeZonePx, MIN_WINDOW_SEC,
  TRIM_EDGE_PX, TRIM_EDGE_PX_COARSE, TRIM_SHIFT_FRAMES,
} = await import('./video-edit-inline.ts');

// ── fixture ───────────────────────────────────────────────────────────────────

interface EnqueuedJob { req: Record<string, unknown>; hooks: { onComplete?: (r: AssetRef) => void } }
const jobs = (): EnqueuedJob[] => ((globalThis as unknown as { __vjobs?: EnqueuedJob[] }).__vjobs ??= []);

const REF = { id: 'user/video/clip', type: 'video', url: 'blob:clip', format: 'mp4', meta: { name: 'clip.mp4', bytes: 1024 } } as unknown as AssetRef;

const host = { log() {} } as unknown as Parameters<typeof mountInlineVideoEdit>[0];

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise<void>(r => setTimeout(r, 0));
}

/** The readout's own m:ss.s shape, so a nudge assertion reads as a TIME rather than as
 *  a float the reader has to convert in their head. Deliberately a copy: pinning the
 *  module's formatter against itself would assert nothing. */
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const rest = sec - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

/**
 * One pointer event on the strip. jsdom has no PointerEvent and no pointer capture, but
 * the strip's handlers read exactly three things off the event - clientX, pointerType and
 * pointerId - so a MouseEvent under a pointer type name drives the whole gesture. An
 * undefined pointerType selects the precise-pointer zone, and the capture calls the
 * module makes are already guarded for a host that has none.
 */
function pointer(el: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number): void {
  el.dispatchEvent(new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX }));
}

/** Give an element a box, which jsdom otherwise reports as all zeros. The strip refuses
 *  to start a drag on a zero-width box, exactly as it would in a hidden panel. */
function withBox(el: HTMLElement, width: number, height = 44): void {
  el.getBoundingClientRect = (() => ({
    x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() { /* unused */ },
  })) as () => DOMRect;
}

interface Rig {
  stage: HTMLElement;
  original: HTMLVideoElement;
  handle: Awaited<ReturnType<typeof mountInlineVideoEdit>>;
  done: Array<AssetRef | null>;
  vid: HTMLVideoElement;
  q<T extends Element>(sel: string): T;
  click(sel: string): void;
  slide(sel: string, value: string): void;
  /** Type a time into an in/out field and commit it (Enter fires `change`). */
  setEdge(edge: 'in' | 'out', text: string): void;
  /** Press a key on a focused strip handle. jsdom has no PointerEvent, so this is the
   *  one edge gesture that CAN be driven here; the pointer drag is covered by the pure
   *  model instead, exactly like the crop box's. */
  nudge(edge: 'in' | 'out', key: string, shift?: boolean): void;
}

async function mount(initialTab: 'crop' | 'grade' | 'trim', durationSec = 10): Promise<Rig> {
  srcDuration = durationSec;
  (globalThis as unknown as { __vjobs?: EnqueuedJob[] }).__vjobs = [];
  const doc = dom.window.document;
  doc.body.innerHTML = '<div class="cat-details-preview"><div class="cat-zoom-stage"><video class="cat-thumb" loop autoplay muted></video></div></div>';
  const stage = doc.querySelector<HTMLElement>('.cat-details-preview')!;
  const original = doc.querySelector<HTMLVideoElement>('video.cat-thumb')!;
  const done: Array<AssetRef | null> = [];
  const handle = await mountInlineVideoEdit(host, {
    stage, video: original, ref: REF, name: 'clip.mp4', initialTab,
    onDone: (made) => { done.push(made); },
  });
  const q = <T extends Element>(sel: string): T => {
    const el = stage.querySelector<T>(sel);
    assert.ok(el, `expected ${sel} in the mode`);
    return el!;
  };
  const vid = q<HTMLVideoElement>('[data-preview]');
  // Metadata is what fills the scrub range, the readouts and the refusal.
  vid.dispatchEvent(new W.Event('loadedmetadata'));
  return {
    stage, original, handle, done, vid, q,
    click: (sel) => q<HTMLElement>(sel).dispatchEvent(new W.MouseEvent('click', { bubbles: true })),
    slide: (sel, value) => {
      const el = q<HTMLInputElement>(sel);
      el.value = value;
      el.dispatchEvent(new W.Event('input', { bubbles: true }));
    },
    setEdge: (edge, text) => {
      const el = q<HTMLInputElement>(`[data-${edge}-time]`);
      el.value = text;
      el.dispatchEvent(new W.Event('change', { bubbles: true }));
    },
    nudge: (edge, key, shift = false) => {
      const el = q<HTMLElement>(`[data-edge="${edge}"]`);
      el.dispatchEvent(new W.KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
    },
  };
}

// ── the stage ─────────────────────────────────────────────────────────────────

test('the mode mounts every tab over the stage, with the requested one selected', async () => {
  const rig = await mount('trim');
  const tabs = [...rig.stage.querySelectorAll<HTMLButtonElement>('[data-tab]')].map(b => b.dataset.tab);
  assert.deepEqual(tabs, ['crop', 'grade', 'trim'], 'Crop, Grade and Trim are three tabs of ONE mode, not three modes');
  assert.equal(rig.q<HTMLElement>('[data-panel="trim"]').hidden, false, 'the requested tab is the open one');
  assert.equal(rig.q<HTMLElement>('[data-panel="grade"]').hidden, true, 'and the other one is put away');
  assert.ok(rig.q<HTMLVideoElement>('[data-preview]'), 'the mode brings its own paused <video>; the .cat-thumb stays hidden');
  const pauses = (rig.original as unknown as Record<string, number>).__pauseCalls ?? 0;
  assert.ok(pauses >= 1, 'the original autoplaying preview is PAUSED, not merely display:none-d - CSS never stops a decoder');
  assert.equal(rig.original.loop, false, 'and it is not left looping behind the mode');
  rig.handle.exit();
});

// ── the refusal follows the SELECTED WINDOW, not the source ───────────────────

test('a 300s source is refused for trim, and the refusal clears once in/out fit the cap', async () => {
  const rig = await mount('trim', 300);
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  const apply = rig.q<HTMLButtonElement>('[data-apply]');
  assert.equal(refusal.hidden, false, 'the whole 300s clip is over the job cap');
  assert.match(refusal.textContent ?? '', /too long/i);
  assert.equal(apply.disabled, true, 'and Apply is not offered while it stands');

  // ADJUSTED 2026-08-19: was two clicks on Set in / Set out at the playhead. Those
  // buttons are gone - the strip's handles are the primary gesture and the readouts are
  // the optional typed path, so the window is now SAID rather than stamped.
  rig.setEdge('in', '10');
  rig.setEdge('out', '100');

  assert.equal(refusal.hidden, true, 'a 90s window fits, so the refusal clears - recomputed per in/out change');
  assert.equal(apply.disabled, false, 'and the trim becomes applicable');
  rig.handle.exit();
});

test('the same clip refused on the grade tab is pointed at the other tab', async () => {
  const rig = await mount('grade', 300);
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  assert.equal(refusal.hidden, false, 'a grade runs over the whole clip, so the cap stands');
  assert.match(refusal.textContent ?? '', /Trim it shorter first\./, 'and the way out is named, not left to be guessed');
  rig.handle.exit();
});

// ── Apply: the request shapes ─────────────────────────────────────────────────

test('Apply on the trim tab enqueues op:trim with the range and fps 0 (source rate)', async () => {
  const rig = await mount('trim', 60);
  // ADJUSTED 2026-08-19: the Set in / Set out buttons are gone (see above); the same
  // two points are typed into the in/out fields, which run the same writer.
  rig.setEdge('in', '5');
  rig.setEdge('out', '21.5');
  rig.click('[data-apply]');
  await settle();

  assert.equal(jobs().length, 1, 'exactly one background job');
  const req = jobs()[0]!.req as { op: string; sourceName: string; range: { startSec: number; endSec: number }; trim: { fps: number; bitrate: number } };
  assert.equal(req.op, 'trim');
  assert.equal(req.sourceName, 'clip.mp4');
  assert.deepEqual(req.range, { startSec: 5, endSec: 21.5 }, 'the in/out points ARE the request');
  assert.equal(req.trim.fps, 0, 'fps 0 means "keep the source rate" - a trim changes when, never how smooth');
  assert.ok(req.trim.bitrate > 0);
  assert.deepEqual(rig.done, [null], 'the mode ends on enqueue; the toast owns the job from here');
});

test('the snap-to-keyframe checkbox is off by default - a trim runs exact bounds', async () => {
  const rig = await mount('trim', 60);
  rig.setEdge('in', '5');
  rig.setEdge('out', '21.5');
  assert.equal(rig.q<HTMLInputElement>('[data-snap]').checked, false, 'default UNCHECKED - opt-in only');
  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { trim: { snapToKeyframe?: boolean } };
  assert.equal(req.trim.snapToKeyframe, undefined, 'unchecked leaves the field off, so exact bounds run');
});

test('checking snap-to-keyframe opts the trim into the lossless packet-copy fast path', async () => {
  const rig = await mount('trim', 60);
  rig.setEdge('in', '5');
  rig.setEdge('out', '21.5');
  rig.q<HTMLInputElement>('[data-snap]').checked = true;
  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { trim: { snapToKeyframe?: boolean } };
  assert.equal(req.trim.snapToKeyframe, true, 'checked flips the trim to the keyframe-aligned packet copy');
});

test('a trim that has not moved an edge is not applicable, and the missing gesture is named', async () => {
  // The tab OPENS on the whole clip, so this is its first state rather than an
  // unusual one. Applying it would re-encode the source to a lossy copy and hand it
  // a c2pa.edited action reading "Trimmed to a shorter clip" - a credential
  // asserting an edit that did not happen, which is the one thing this mode's
  // provenance chain exists to prevent.
  const rig = await mount('trim', 60);
  const apply = rig.q<HTMLButtonElement>('[data-apply]');
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  assert.equal(apply.disabled, true, 'in=0, out=duration is a trim of nothing');
  assert.equal(refusal.hidden, false, 'and a dead Apply with no reason beside it is a bug of its own');
  assert.match(refusal.textContent ?? '', /drag an edge/i, 'the way out is a gesture, so the gesture is named');

  // The same untouched window must not ride along on another tab either: `range` is
  // the reader's decode window, and one covering the whole clip says nothing.
  rig.click('[data-tab="crop"]');
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, false, 'a crop of the whole clip IS an edit');
  rig.click('[data-apply]');
  await settle();
  assert.equal(jobs().length, 1);
  const req = jobs()[0]!.req as { op: string; range?: unknown };
  assert.equal(req.op, 'crop');
  assert.equal(req.range, undefined, 'a window over the whole clip is no window, on any tab');
});

test('one nudged frame is a trim: Apply comes back, and the job carries the narrowed window', async () => {
  const rig = await mount('trim', 60);
  const apply = rig.q<HTMLButtonElement>('[data-apply]');
  assert.equal(apply.disabled, true, 'the untouched window is not applicable');

  rig.nudge('out', 'ArrowLeft');
  assert.equal(apply.disabled, false, 'one frame off the end is a real cut, so Apply is offered');
  assert.equal(rig.q<HTMLElement>('[data-refusal]').hidden, true, 'and the hint goes with the state it described');

  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { op: string; range: { startSec: number; endSec: number } };
  assert.equal(req.op, 'trim');
  assert.equal(req.range.startSec, 0);
  assert.ok(Math.abs(req.range.endSec - (60 - 1 / 30)) < 1e-9, 'the window that was actually selected');
});

test('Apply on the grade tab enqueues op:grade with the percent sliders mapped back to 0..1', async () => {
  const rig = await mount('grade');
  rig.slide('[data-intensity]', '80');
  rig.slide('[data-grain]', '40');
  rig.slide('[data-grainsize]', '2.5');
  rig.slide('[data-vignette]', '20');
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, false, 'grain/vignette alone is a legal grade');
  rig.click('[data-apply]');
  await settle();

  assert.equal(jobs().length, 1);
  const req = jobs()[0]!.req as { op: string; grade: Record<string, number | string> };
  assert.equal(req.op, 'grade');
  assert.equal(req.grade.cubeText, '', 'no look picked - the adjustments still stand on their own');
  assert.equal(req.grade.lutIntensity, 0.8);
  assert.equal(req.grade.grain, 0.4);
  assert.equal(req.grade.grainSize, 2.5, 'grain SIZE is already in its own 1..4 units');
  assert.equal(req.grade.vignette, 0.2);
  assert.equal(req.grade.fps, 0, 'fps 0 means "keep the source rate" - a look changes colour, never timing');
  assert.equal(typeof req.grade.seed, 'number', 'a fixed seed, so the preview and the render agree');
});

test('the live preview grades grain against the render\'s reference long edge', () => {
  // A SOURCE SCAN, because jsdom has no 2-D context: the preview can never paint here,
  // so the call itself is the only thing left to pin - and it is worth pinning. The
  // preview works at PREVIEW_MAX_EDGE while the render works at source resolution, and
  // grainSize is a lattice CELL: without the reference edge the rendered grain is twice
  // as fine as the previewed one on 1080p and four times on 4K, so the slider is judged
  // against a texture the file never gets.
  const src = readFileSync(new URL('./video-edit-inline.ts', import.meta.url), 'utf8');
  assert.match(
    src, /applyGrainVignette\(img\.data, w, h, \{[^}]*\}, 0, GRAIN_REF_LONG_EDGE\)/,
    'the preview passes the engine\'s own reference long edge, the same one the job passes',
  );
});

test('a neutral grade is not applicable - nothing to encode', async () => {
  const rig = await mount('grade');
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, true, 'no look, no grain, no vignette');
  rig.handle.exit();
});

// ── busy() and exit() ─────────────────────────────────────────────────────────

test('busy() covers the enqueue, and a second Apply cannot double-enqueue', async () => {
  const rig = await mount('trim', 60);
  rig.setEdge('out', '30');   // a trim that trims nothing is not applicable at all
  rig.click('[data-apply]');
  assert.equal(rig.handle.busy(), true, 'busy from the click until the job is handed over');
  rig.click('[data-apply]');
  await settle();
  assert.equal(jobs().length, 1, 'the second click found the mode busy');
  assert.equal(rig.handle.busy(), false, 'and the beat is over once it is enqueued');
});

test('exit() puts the original preview back, and is idempotent', async () => {
  const rig = await mount('grade');
  assert.equal(rig.original.loop, false, 'the mode stops the hidden preview looping while it owns the stage');

  rig.handle.exit();
  assert.equal(rig.stage.querySelector('.cat-vid-work'), null, 'the mode DOM is gone');
  assert.equal(rig.original.loop, true, 'and the original video gets its playback back exactly as found');
  assert.equal(rig.original.autoplay, true);
  assert.deepEqual(rig.done, [null], 'onDone fires once, with nothing made');

  rig.handle.exit();
  assert.deepEqual(rig.done, [null], 'a second exit is a no-op, not a second onDone');
});

test('exit() plays an original that carries autoplay but had not started yet', async () => {
  // The catalog's preview is `autoplay muted loop preload="metadata"`, so `paused` is
  // true for the beat between opening the modal and playback actually starting -
  // which is exactly the beat this mode is usually entered in. pause() clears the
  // element's autoplaying flag for good, so putting the ATTRIBUTE back cannot restart
  // it: gating the restart on the paused reading left the catalog a dead still frame
  // for the rest of that modal's life. jsdom reports paused=true from birth, which is
  // that state precisely.
  const rig = await mount('grade');
  let played = 0;
  rig.original.play = (): Promise<void> => { played++; return Promise.resolve(); };

  rig.handle.exit();
  assert.equal(played, 1, 'an element that carries autoplay is played again, best effort');
  assert.equal(rig.original.autoplay, true, 'and its attributes are put back as found');
  assert.equal(rig.original.loop, true);
});

// ── Crop: the box is a MODEL, because the drag is out of jsdom's reach ────────
// jsdom has no layout and no pointer capture, so the box's pixels can't be
// exercised here. What CAN be pinned is the model those pixels paint: the
// fractions it opens at, the pure drag maths, and the source rect Apply derives.

test('the crop tab opens with the box 60% centred, over the frame', async () => {
  const rig = await mount('crop');
  assert.equal(rig.q<HTMLElement>('[data-panel="crop"]').hidden, false, 'the requested tab is the open one');
  assert.equal(rig.q<HTMLElement>('[data-crop]').hidden, false, 'and its box overlays the frame');
  const box = rig.q<HTMLElement>('[data-crop-box]');
  assert.equal(box.style.left, '20%', '20% in from the left…');
  assert.equal(box.style.top, '20%', '…and from the top');
  assert.equal(box.style.width, '60%', 'leaving a 60% box');
  assert.equal(box.style.height, '60%');
  assert.equal(rig.stage.querySelectorAll('[data-crop-box] [data-h]').length, 8, 'four edges and four corners are all grabbable');
  // The box is painted in PERCENT, not pixels: the stage is sized from its
  // container, so a resize must move the box with the picture, not off it.
  assert.deepEqual(DEFAULT_CROP_FRAC, { x: 0.2, y: 0.2, w: 0.6, h: 0.6 });
  rig.handle.exit();
});

test('the crop box hides itself on the other tabs', async () => {
  const rig = await mount('crop');
  rig.click('[data-tab="grade"]');
  assert.equal(rig.q<HTMLElement>('[data-crop]').hidden, true, 'a box over a grade would frame nothing');
  rig.click('[data-tab="crop"]');
  assert.equal(rig.q<HTMLElement>('[data-crop]').hidden, false);
  rig.handle.exit();
});

test('dragCropFrac moves the box inside the frame and resizes from the grabbed side', () => {
  const min = { w: 0.02, h: 0.02 };
  const start = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };

  const near = (a: number, b: number, why: string): void => assert.ok(Math.abs(a - b) < 1e-9, `${why} (${a} vs ${b})`);

  const moved = dragCropFrac(start, 'move', 0.1, -0.05, min);
  near(moved.x, 0.3, 'the box follows the pointer');
  near(moved.y, 0.15, 'on both axes');
  near(moved.w, 0.6, 'a move never changes the size');
  near(moved.h, 0.6, 'on either axis');

  const shoved = dragCropFrac(start, 'move', 5, 5, min);
  assert.deepEqual(shoved, { x: 0.4, y: 0.4, w: 0.6, h: 0.6 }, 'and it stops at the frame edge rather than leaving it');

  const se = dragCropFrac(start, 'se', 0.1, 0.1, min);
  assert.equal(se.x, 0.2, 'the opposite corner stays put on a resize');
  assert.equal(se.y, 0.2);
  near(se.w, 0.7, 'the grabbed corner is the one that moves');
  near(se.h, 0.7, 'on both axes');

  const nw = dragCropFrac(start, 'nw', -0.3, -0.3, min);
  assert.equal(nw.x, 0, 'a corner dragged past the frame clamps to it');
  assert.equal(nw.y, 0);
  near(nw.w, 0.8, 'growing only as far as the frame allows');

  const w = dragCropFrac(start, 'w', 0.9, 0, min);
  near(w.w, min.w, 'and a side collapsed past the minimum stops there');
  near(w.h, 0.6, 'an edge drag only moves its own axis');
});

test('cropRectFromFrac converts to SOURCE pixels and snaps them even for the encoder', () => {
  assert.deepEqual(cropRectFromFrac(DEFAULT_CROP_FRAC, 1280, 720), { x: 256, y: 144, w: 768, h: 432 });
  // An odd source with an awkward box: every number the encoder is handed has to
  // come out even, and the rect has to stay inside the frame.
  const r = cropRectFromFrac({ x: 0.1234, y: 0.3777, w: 0.5, h: 0.5 }, 1281, 721);
  for (const n of [r.x, r.y, r.w, r.h]) assert.equal(n % 2, 0, `${n} is even`);
  assert.ok(r.x + r.w <= 1281 && r.y + r.h <= 721, 'and it never runs off the frame');
});

test('Apply on the crop tab enqueues op:crop with the even-snapped rect', async () => {
  const rig = await mount('crop', 60);
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, false, 'a box on a readable frame is applicable');
  rig.click('[data-apply]');
  await settle();

  assert.equal(jobs().length, 1, 'exactly one background job');
  const req = jobs()[0]!.req as { op: string; sourceName: string; range?: unknown; crop: { rect: Record<string, number>; fps: number; bitrate: number } };
  assert.equal(req.op, 'crop');
  assert.equal(req.sourceName, 'clip.mp4');
  assert.deepEqual(req.crop.rect, { x: 256, y: 144, w: 768, h: 432 }, '60% of a 1280×720 source, snapped even');
  assert.equal(req.crop.fps, 30);
  assert.equal(req.crop.bitrate, 8_000_000);
  assert.equal(req.range, undefined, 'no in/out was set, so the whole clip is the window');
  assert.deepEqual(rig.done, [null], 'the mode ends on enqueue; the toast owns the job from here');
});

// ── The window composes with the other tabs ──────────────────────────────────

test('a window set on the trim tab rides along on a CROP job', async () => {
  const rig = await mount('crop', 300);
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  assert.equal(refusal.hidden, false, 'the whole 300s clip is over the job cap');
  assert.match(refusal.textContent ?? '', /Trim it shorter first\./, 'and the way out is named');

  rig.click('[data-tab="trim"]');
  // ADJUSTED 2026-08-19: typed in/out instead of the removed Set in / Set out buttons.
  rig.setEdge('in', '10');
  rig.setEdge('out', '100');
  rig.click('[data-tab="crop"]');

  assert.equal(refusal.hidden, true, 'a 90s window fits, so the crop is no longer refused');
  const calls = (globalThis as unknown as { __refusalCalls: Array<{ op: string; range?: { startSec: number; endSec: number } }> }).__refusalCalls;
  const last = calls[calls.length - 1]!;
  assert.equal(last.op, 'crop', 'the refusal is computed for the OPEN tab…');
  assert.deepEqual(last.range, { startSec: 10, endSec: 100 }, '…against the window that will actually be decoded');

  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { op: string; range: { startSec: number; endSec: number }; crop: { rect: Record<string, number> } };
  assert.equal(req.op, 'crop');
  assert.deepEqual(req.range, { startSec: 10, endSec: 100 }, 'one job crops AND windows - range is a request-level field');
  assert.deepEqual(req.crop.rect, { x: 256, y: 144, w: 768, h: 432 });
});

test('the same window clears the grade nudge and rides along on a GRADE job', async () => {
  const rig = await mount('grade', 300);
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  assert.match(refusal.textContent ?? '', /Trim it shorter first\./, 'the whole clip is too long to grade');

  rig.click('[data-tab="trim"]');
  // ADJUSTED 2026-08-19: typed in/out instead of the removed Set in / Set out buttons.
  rig.setEdge('in', '30');
  rig.setEdge('out', '90');
  rig.click('[data-tab="grade"]');

  assert.equal(refusal.hidden, true, 'a 60s window fits, so the grade is allowed');
  assert.equal(refusal.textContent, '', 'and the "trim it shorter" nudge goes with the refusal it hung off');

  rig.slide('[data-grain]', '25');
  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { op: string; range: { startSec: number; endSec: number }; grade: Record<string, number> };
  assert.equal(req.op, 'grade');
  assert.deepEqual(req.range, { startSec: 30, endSec: 90 }, 'the grade encodes the selected window, not the whole 300s');
  assert.equal(req.grade.grain, 0.25);
});

test('a grade with no window sends none - a window over the whole clip says nothing', async () => {
  const rig = await mount('grade', 60);
  rig.slide('[data-vignette]', '30');
  rig.click('[data-apply]');
  await settle();
  const req = jobs()[0]!.req as { range?: unknown };
  assert.equal(req.range, undefined);
});

// ── Trim: the strip is the gesture, the numbers are the fallback ──────────────
// Same split as the crop box above: jsdom has no layout, no PointerEvent and no
// pointer capture, so the drag's PICTURE cannot be exercised here - only the model it
// paints, which is why that model is pure and exported. Everything the keyboard and the
// typed fields reach IS driveable, and both go through the same writer as the drag, so
// the clamps are pinned once for all three doors.
//
// The gesture's BOOKKEEPING is driveable too, with a measured box and a MouseEvent under
// a pointer name (the handlers read clientX, pointerType and pointerId and nothing else).
// That is where the frame-timing bugs live, so the release path is pinned below.
//
// The one property no test here can reach: the drag's ANCHOR. dragTrimEdge is relative,
// so a pointer drag has to measure every frame against the window it grabbed, while a
// key press measures against the window as it stands. Getting that wrong doubles the
// pointer delta on the second frame of a drag and is only visible in a browser.

test('the trim tab leads with a filmstrip and its two edge handles, not with Set in/Set out', async () => {
  const rig = await mount('trim', 60);
  assert.equal(rig.stage.querySelector('[data-set-in]'), null, 'the stamp-at-the-playhead buttons are gone');
  assert.equal(rig.stage.querySelector('[data-set-out]'), null);

  const strip = rig.q<HTMLElement>('[data-strip]');
  assert.ok(strip, 'the strip is the primary control');
  assert.ok(strip.querySelector('canvas[data-strip-canvas]'), 'with a canvas for the frames');
  const edges = [...strip.querySelectorAll<HTMLButtonElement>('[data-edge]')].map(b => b.dataset.edge);
  assert.deepEqual(edges, ['in', 'out'], 'and one draggable handle per end');
  for (const edge of ['in', 'out'] as const) {
    const el = rig.q<HTMLButtonElement>(`[data-edge="${edge}"]`);
    assert.equal(el.tagName, 'BUTTON', 'a real button, so it is in the tab order');
    assert.ok((el.getAttribute('aria-label') ?? '').length > 0, `the ${edge} handle names itself`);
    assert.equal(el.getAttribute('role'), 'slider', 'and reports a value, not just a name');
  }
  // The readouts became fields: manual entry stays available, it is simply no longer
  // the only way in.
  assert.equal(rig.q<HTMLInputElement>('[data-in-time]').tagName, 'INPUT', 'the in readout is typeable');
  assert.equal(rig.q<HTMLInputElement>('[data-out-time]').tagName, 'INPUT', 'so is the out one');
  rig.handle.exit();
});

test('the filmstrip mounts EMPTY under a headless run, and takes nothing down with it', async () => {
  // clip-thumbs resolves empty for anything it cannot decode - and jsdom can decode
  // nothing at all. The property being pinned is that this costs the tab its picture
  // and nothing else: the strip is still there, still sized, and every control on it
  // still answers. If the capture ever started throwing, this mount would reject.
  const rig = await mount('trim', 60);
  const canvas = rig.q<HTMLCanvasElement>('[data-strip-canvas]');
  await settle();
  assert.equal(canvas.width, 300, 'nothing was painted, so the canvas keeps its default backing store');
  assert.equal(rig.q<HTMLElement>('[data-strip]').classList.contains('has-frames'), false, 'and it is not claiming frames it has not got');
  // The window still works over a blank strip.
  rig.setEdge('out', '30');
  assert.equal(rig.q<HTMLInputElement>('[data-out-time]').value, '0:30.0');
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, false, 'a trim over an undecodable-preview source is still a trim');
  rig.handle.exit();
});

test('dragTrimEdge moves ONE edge, clamps to the source, and keeps a window worth encoding', () => {
  const near = (a: number, b: number, why: string): void => assert.ok(Math.abs(a - b) < 1e-9, `${why} (${a} vs ${b})`);
  const start = { inSec: 2, outSec: 8 };

  const inRight = dragTrimEdge(start, 'in', 1.5, 10);
  near(inRight.inSec, 3.5, 'the in point follows the pointer');
  near(inRight.outSec, 8, 'and the other end stays exactly where it was');

  const outLeft = dragTrimEdge(start, 'out', -2, 10);
  near(outLeft.inSec, 2, 'the same the other way round');
  near(outLeft.outSec, 6, 'the out point follows the pointer');

  assert.deepEqual(dragTrimEdge(start, 'in', -9, 10), { inSec: 0, outSec: 8 }, 'an in point dragged off the front stops at 0');
  assert.deepEqual(dragTrimEdge(start, 'out', 9, 10), { inSec: 2, outSec: 10 }, 'and an out point stops at the duration');

  // The floor is the whole reason this is a model and not two clamps at the call site:
  // an edge dragged THROUGH the other one must leave something Apply will accept.
  const crushedIn = dragTrimEdge(start, 'in', 99, 10);
  near(crushedIn.inSec, 8 - MIN_WINDOW_SEC, 'the in point stops a window short of the out point');
  near(crushedIn.outSec, 8, 'without dragging it along');
  const crushedOut = dragTrimEdge(start, 'out', -99, 10);
  near(crushedOut.outSec, 2 + MIN_WINDOW_SEC, 'and the out point stops a window past the in point');
  near(crushedOut.inSec, 2, 'without dragging the in point along');
  assert.ok(MIN_WINDOW_SEC > 1 / 30, 'the floor is STRICTLY more than the frame Apply demands, or a drag could park on a refusal');

  // Total on nonsense, like dragCropFrac: no duration is not a crash, it is no window.
  assert.deepEqual(dragTrimEdge(start, 'in', 1, 0), { inSec: 0, outSec: 0 });
  assert.deepEqual(dragTrimEdge(start, 'out', Number.NaN, 10), { inSec: 2, outSec: 8 }, 'a non-finite delta moves nothing');
});

test('one drag applies its TOTAL delta to the window it GRABBED, never compounding per tick', () => {
  // A real bug, found in a browser on 2026-08-19: a roughly 50px drag (about 1s on a
  // 10s strip) threw the out point 9.9s. The pointer path is rAF-coalesced, so every
  // tick recomputes the whole distance since pointerdown - and feeding that total to a
  // model anchored on the CURRENT window re-applies the entire distance on top of the
  // last application. The growth is quadratic in the tick count, and the giveaway is an
  // origin window captured at pointerdown that nothing ever reads.
  //
  // Per-event increments are NOT the fix: rAF coalescing drops intermediate moves, so
  // increments would silently under-shoot. The origin window is.
  const near = (a: number, b: number, why: string): void => assert.ok(Math.abs(a - b) < 1e-9, `${why} (${a} vs ${b})`);
  const origin = { inSec: 1, outSec: 5 };
  const ticks = [0.2, 0.5, 1.0];   // one drag, sampled three times, each a total from x0

  let live = origin;
  for (const total of ticks) live = dragTrimEdge(origin, 'out', total, 10);
  near(live.outSec, 6, 'three ticks of a 1.0s drag land 1.0s out, exactly where the pointer is');
  near(live.inSec, 1, 'and the edge that was not grabbed has not moved');

  // The shape being guarded against, spelled out so a future refactor that reintroduces
  // it fails here rather than in someone's recording.
  let compounded = origin;
  for (const total of ticks) compounded = dragTrimEdge(compounded, 'out', total, 10);
  near(compounded.outSec, 6.7, 'anchoring on the current window sums the totals instead');
  assert.ok(compounded.outSec > live.outSec, 'which runs away from the pointer, further with every tick');
});

test('releasing an edge applies the release position, even when no frame ever painted', async () => {
  // The pointer path is rAF-coalesced, so the last move of a gesture is normally still
  // pending when the pointer comes up - and a gesture short enough to fit inside one
  // frame (a flick, or a small precise nudge) never reaches the rAF at all. Cancelling
  // that frame on pointerup therefore threw the release away: the handle snapped back to
  // where it was grabbed with nothing said. Every assertion below is made in the SAME
  // tick as the dispatch, so no frame can have painted - what lands is the flush.
  const rig = await mount('trim', 60);
  const strip = rig.q<HTMLElement>('[data-strip]');
  withBox(strip, 300);
  const outField = rig.q<HTMLInputElement>('[data-out-time]');

  pointer(strip, 'pointerdown', 300);   // the out handle sits at the far end
  pointer(strip, 'pointermove', 270);   // 30px back along a 300px/60s strip is 6s
  pointer(strip, 'pointerup', 270);
  assert.equal(outField.value, fmt(54), 'the window ends where the pointer was let go, not where the last frame left it');
  assert.equal(rig.q<HTMLButtonElement>('[data-apply]').disabled, false, 'and the quick drag is a real trim');

  await settle();
  assert.equal(outField.value, fmt(54), 'the cancelled frame does not land a second time afterwards');

  // A grab with no movement is still just a grab: nothing to flush, nothing moved.
  pointer(strip, 'pointerdown', 270);
  pointer(strip, 'pointerup', 270);
  assert.equal(outField.value, fmt(54));
  rig.handle.exit();
});

test('the edge hit zone is wider for a finger than for a cursor, and never swallows the strip', () => {
  assert.equal(trimEdgeZonePx(400, 'mouse'), TRIM_EDGE_PX, 'a precise pointer gets the precise zone');
  assert.equal(trimEdgeZonePx(400, undefined), TRIM_EDGE_PX, 'an unknown pointer is treated as a mouse');
  assert.equal(trimEdgeZonePx(400, 'touch'), TRIM_EDGE_PX_COARSE, 'a finger gets WCAG 2.5.8 AA');
  assert.equal(trimEdgeZonePx(400, 'pen'), TRIM_EDGE_PX_COARSE, 'so does a pen');
  assert.ok(TRIM_EDGE_PX_COARSE > TRIM_EDGE_PX, 'the two are deliberately different numbers');
  // Two zones can never meet: 2 x floor(w/3) < w for every w.
  assert.equal(trimEdgeZonePx(60, 'touch'), 20, 'a third of a narrow strip is the ceiling');
  assert.ok(2 * trimEdgeZonePx(60, 'touch') < 60, 'leaving strip left over that still seeks');
  assert.equal(trimEdgeZonePx(20, 'touch'), 0, 'and a strip too narrow to hold two targets offers none');
  assert.equal(trimEdgeZonePx(Number.NaN, 'mouse'), 0);
});

test('an arrow key on a focused handle nudges a frame, and Shift makes it ten', async () => {
  const rig = await mount('trim', 60);
  const outField = rig.q<HTMLInputElement>('[data-out-time]');
  const frame = 1 / 30;

  rig.nudge('out', 'ArrowLeft');
  assert.equal(outField.value, fmt(60 - frame), 'one press, one frame');
  rig.nudge('out', 'ArrowLeft', true);
  assert.equal(outField.value, fmt(60 - frame * (1 + TRIM_SHIFT_FRAMES)), 'Shift multiplies the same step');
  rig.nudge('out', 'ArrowRight', true);
  assert.equal(outField.value, fmt(60 - frame), 'and it goes back the other way');

  rig.nudge('in', 'ArrowRight');
  assert.equal(rig.q<HTMLInputElement>('[data-in-time]').value, fmt(frame), 'the in handle moves its own edge');
  rig.nudge('in', 'ArrowUp');
  assert.equal(rig.q<HTMLInputElement>('[data-in-time]').value, fmt(frame), 'a key with no meaning here is left alone');
  rig.handle.exit();
});

test('parseTimeText reads m:ss.s and plain seconds, and refuses everything else', () => {
  assert.equal(parseTimeText('12'), 12, 'plain seconds');
  assert.equal(parseTimeText('12.5'), 12.5, 'with a fraction');
  assert.equal(parseTimeText('.5'), 0.5, 'and a bare fraction');
  assert.equal(parseTimeText('  7 '), 7, 'surrounding space is not an error');
  assert.equal(parseTimeText('1:05'), 65, 'the shape the readout prints');
  assert.equal(parseTimeText('1:05.5'), 65.5, 'tenths and all');
  assert.equal(parseTimeText('0:00.0'), 0, 'including the one it starts at');
  assert.equal(parseTimeText('1:02:03'), 3723, 'and an hours field for a long source');

  for (const junk of ['', '   ', 'abc', '1:', ':30', '-5', '5s', '1:75', '1:2:3:4', '1..2', '1e3', 'Infinity', 'NaN']) {
    assert.equal(parseTimeText(junk), null, `"${junk}" is not a time`);
  }
});

test('a nonsense time reverts to the current value; a legal one commits and is clamped', async () => {
  const rig = await mount('trim', 120);
  const inField = rig.q<HTMLInputElement>('[data-in-time]');
  const outField = rig.q<HTMLInputElement>('[data-out-time]');

  rig.setEdge('in', '1:05.5');
  assert.equal(inField.value, '1:05.5', 'a typed time commits and is printed back in the readout shape');

  rig.setEdge('in', 'half past four');
  assert.equal(inField.value, '1:05.5', 'nonsense puts the current value back rather than guessing');

  rig.setEdge('out', '999');
  assert.equal(outField.value, '2:00.0', 'and a legal time past the end is clamped by the same writer the drag uses');

  rig.setEdge('out', '0');
  assert.equal(
    outField.value, fmt(65.5 + MIN_WINDOW_SEC),
    'an out point typed through the in point stops a window short of it, exactly as a dragged one does',
  );
  rig.handle.exit();
});

test('the live refusal is recomputed as the window moves, not on release', async () => {
  const rig = await mount('trim', 300);
  const refusal = rig.q<HTMLElement>('[data-refusal]');
  const apply = rig.q<HTMLButtonElement>('[data-apply]');
  assert.equal(refusal.hidden, false, 'the whole 300s clip is over the job cap');

  // Every door onto the window - the drag's rAF, the keyboard, the fields - ends in the
  // same applyWindow(), so driving the one jsdom can reach pins the recompute for all
  // three. The point is that it happens PER CHANGE.
  const before = ((globalThis as unknown as { __refusalCalls: unknown[] }).__refusalCalls ?? []).length;
  rig.setEdge('in', '100');
  assert.equal(refusal.hidden, false, 'a 200s window is still too long');
  rig.setEdge('out', '200');
  assert.equal(refusal.hidden, true, 'and it clears the moment the window fits - no release, no re-open');
  assert.equal(apply.disabled, false);

  const calls = (globalThis as unknown as { __refusalCalls: Array<{ op: string; range?: { startSec: number; endSec: number } }> }).__refusalCalls;
  assert.ok(calls.length > before + 1, 'the refusal was asked again on each edge change');
  assert.deepEqual(calls[calls.length - 1]?.range, { startSec: 100, endSec: 200 }, 'against the window that will actually be decoded');

  rig.nudge('out', 'ArrowRight', true);
  assert.equal(refusal.hidden, true, 'a nudge that keeps it inside the cap keeps it clear');
  rig.handle.exit();
});

test('a job that lands later reports its ref through onDone, so the catalog can refresh', async () => {
  const rig = await mount('trim', 60);
  rig.setEdge('out', '30');   // a trim that trims nothing is not applicable at all
  rig.click('[data-apply]');
  await settle();
  assert.deepEqual(rig.done, [null], 'the mode already ended when the job was enqueued');
  const made = { id: 'user/video/clip-trimmed' } as unknown as AssetRef;
  jobs()[0]!.hooks.onComplete?.(made);
  assert.equal(rig.done.length, 2, 'the landing job is a second, separate report');
  assert.equal(rig.done[1], made);
});
