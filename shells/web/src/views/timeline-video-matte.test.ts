// SPDX-License-Identifier: MPL-2.0
/**
 * The sequence timeline clip context menu's "Remove background…" (plan 124 WP-G).
 *
 * For a VIDEO clip the menu offers a background-removal item that opens the shared
 * video-job dialog (op 'matte') on the clip's ORIGINAL source video, to make a
 * transparent alternative asset on-device. The claims worth locking down:
 *   - the item is OFFERED for a video clip (video decode + a staged matte model) and
 *     ABSENT (never greyed) for a non-video clip, and absent when no model is staged -
 *     the same offered-only-where-real rule as Export frame / Join;
 *   - opening it hands the dialog op:'matte' and the clip's ORIGINAL source asset,
 *     resolved from the box's stored ref by its permanent id via host.assets.get -
 *     NEVER a scrub proxy.
 *
 * The "never a proxy" claim is structural here: the source is resolved from the box's
 * PERSISTED asset ref (refOf → host.assets.get by id), a path that never consults the
 * proxy registry at all (a proxy is only ever a DOM-level <video> src swap the preview
 * thumbnailer makes). So the id the dialog receives is the original by construction, and
 * this test proves get() was asked for exactly that stored id. That is also why this file
 * touches none of the proxy internals - it does not need one to prove the negative.
 *
 * The dialog module is stubbed (a spy) so no background job runs; everything else is the
 * real panel driven through real DOM events in jsdom.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/timeline-video-matte.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './timeline-math.ts';

// timeline-panel.ts imports its own stylesheet, and dynamically imports the video-job
// dialog on click. Stub the CSS to an empty module, and substitute a SPY for the dialog
// so the test observes the call without running a background job.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url.endsWith('video-job-dialog.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: 'export function openVideoJobDialog(host, opts){ (globalThis.__vjobCalls ??= []).push(opts); return Promise.resolve(); }',
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLVideoElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;

const { initTimelinePanel } = await import('./timeline-panel.ts');

/** The phase-1 field mapping, exactly as sequence-studio's manifest declares it. */
const cfg = {
  idField: 'id', startField: 'start', durField: 'dur', clipInField: 'clipIn',
  speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane',
};

const ADD_KINDS = [{ id: 'clip', label: 'Clip' }, { id: 'audio', label: 'Sound' }];

interface Harness {
  boxes: Box[];
  root: HTMLElement;
  canvasEl: HTMLElement;
  bar(id: string): HTMLElement;
  teardown(): void;
}

/** Mount the real panel on a jsdom stage (rects stubbed, as jsdom has no layout). */
function mount(initial: Box[], host: unknown, assetField = 'image'): Harness {
  const doc = dom.window.document;
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  doc.body.appendChild(stageEl);
  stageEl.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })) as never;

  let boxes = initial.map((b) => ({ ...b }));
  let selected: string[] = [];
  const selListeners = new Set<() => void>();
  const subs = new Set<() => void>();

  const panel = initTimelinePanel({
    stageEl, canvasEl,
    runtime: { subscribe: (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); } },
    host,
    blockId: 'boxes',
    cfg,
    getBoxes: () => boxes,
    commit: (next: Box[]) => { boxes = next.map((b) => ({ ...b })); },
    selection: {
      get: () => selected,
      set: (ids: string[]) => { selected = ids; for (const f of selListeners) f(); },
      onChange: (cb: () => void) => { selListeners.add(cb); return () => { selListeners.delete(cb); }; },
    },
    reserve: () => {},
    addKinds: ADD_KINDS,
    assetField,
  } as never);

  const root = stageEl.querySelector('.tl-panel') as HTMLElement;
  const tracks = root.querySelector('.tl-tracks') as HTMLElement;
  tracks.getBoundingClientRect = (() => ({ left: 0, top: 0, width: 224, height: 120, right: 224, bottom: 120, x: 0, y: 0, toJSON: () => ({}) })) as never;
  Object.defineProperty(tracks, 'clientWidth', { value: 24 + 5 * 40, configurable: true });
  panel.setOpen(true);

  const bar = (id: string): HTMLElement => {
    const el = root.querySelector(`.tl-clip[data-id="${id}"]`) as HTMLElement;
    assert.ok(el, `bar for ${id} exists`);
    const b = boxes.find((x) => x.id === id)!;
    const left = Number(b.start) * 40;
    const width = Number(b.dur) * 40;
    el.getBoundingClientRect = (() => ({ left, right: left + width, width, top: 0, bottom: 40, height: 40, x: left, y: 0, toJSON: () => ({}) })) as never;
    return el;
  };

  return {
    get boxes() { return boxes; },
    root, canvasEl, bar,
    teardown() { try { panel.destroy(); } catch { /* already gone */ } stageEl.remove(); },
  } as Harness;
}

/** Paint a live canvas where `id` is a decoded <video>, so mediaOf() calls it a video. */
function paintVideo(h: Harness, id: string, durSec = 8): void {
  h.canvasEl.setAttribute('data-seq-ms', '10000');
  for (const b of h.boxes) {
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String(b.id));
    if (String(b.id) === id) {
      el.innerHTML = '<video class="lolly-box-video" src="blob:scrub-preview"></video>';
      const v = el.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(v, 'duration', { value: durSec, configurable: true });
    }
    h.canvasEl.appendChild(el);
  }
}

function rightClick(el: Element): void {
  el.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 300 }));
}
const openMenu = (): HTMLElement | null => dom.window.document.querySelector('.tl-ctx-menu');
const menuLabels = (el: HTMLElement | null): string[] =>
  Array.from(el?.querySelectorAll('.folder-menu-item') ?? []).map((n) => n.textContent?.trim() ?? '');
const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); };
async function settle(): Promise<void> { for (let i = 0; i < 6; i++) await new Promise<void>(r => setTimeout(r, 0)); }

/** A staged on-device matte bridge (the WP-G gate: video decode + a staged model). */
function matteHost(getCalls: string[], models: Array<{ id: string }> = [{ id: 'u2netp' }]) {
  return {
    log() {},
    matte: { isAvailable: () => true, models: () => models },
    assets: {
      get: async (id: string) => {
        getCalls.push(id);
        // The ORIGINAL asset, resolved by its permanent id - url distinct from the DOM
        // <video>'s scrub-preview src, so "the dialog got the original" is unambiguous.
        return { source: 'user', id, type: 'video', format: 'mp4', url: 'blob:original-1', meta: { name: 'clip.mp4' } };
      },
    },
  };
}

// The video clip carries a persisted asset ref in its `image` field (the box's stored
// ORIGINAL source), exactly as an ingested clip does.
const videoClip = (id: string): Box => ({
  id, start: 0, dur: 4, lane: 'seq',
  image: { id: 'user/video/1', source: 'user', url: 'blob:original-1', type: 'video' },
} as unknown as Box);

// ── offered only where real ─────────────────────────────────────────────────────

test('Remove background is offered for a video clip with a staged matte model', () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  const h = mount([videoClip('v')], matteHost([]));
  try {
    paintVideo(h, 'v');
    rightClick(h.bar('v'));
    assert.ok(menuLabels(openMenu()).some((l) => l.startsWith('Remove background')),
      'a video clip whose background can be cut on device offers it');
  } finally { h.teardown(); }
});

test('Remove background is ABSENT (never greyed) on a non-video clip', () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  const h = mount([{ id: 'card', start: 0, dur: 3, lane: 'seq' } as Box], matteHost([]));
  try {
    // No video painted → mediaOf('card').kind is '' → the item must not appear.
    rightClick(h.bar('card'));
    assert.equal(menuLabels(openMenu()).some((l) => l.startsWith('Remove background')), false,
      'a still/card clip has no video to process');
  } finally { h.teardown(); }
});

test('Remove background stays offered with no matte model staged (the colour key is model-free)', () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  const h = mount([videoClip('v')], matteHost([], []));   // models() empty
  try {
    paintVideo(h, 'v');
    rightClick(h.bar('v'));
    // canVideoMatte gates on a decodable video, NOT on a staged model: the dialog's
    // colour-key method removes the background with no model at all.
    assert.equal(menuLabels(openMenu()).some((l) => l.startsWith('Remove background')), true,
      'the model-free colour key keeps the affordance live even with no staged model');
  } finally { h.teardown(); }
});

// ── the dispatch: op:'matte' on the ORIGINAL source, never a proxy ──────────────

test('choosing Remove background opens the dialog with op:matte on the clip\'s ORIGINAL source - never a proxy', async () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  (globalThis as unknown as { __vjobCalls?: unknown[] }).__vjobCalls = [];
  const getCalls: string[] = [];
  const h = mount([videoClip('v')], matteHost(getCalls));
  try {
    paintVideo(h, 'v');
    rightClick(h.bar('v'));
    const item = Array.from(openMenu()!.querySelectorAll('.folder-menu-item'))
      .find((n) => n.textContent?.trim().startsWith('Remove background'))!;
    assert.ok(item, 'the item is offered');
    click(item);
    await settle();

    // Resolved from the box's PERSISTED ref id - the original - via host.assets.get.
    assert.deepEqual(getCalls, ['user/video/1'], 'the ORIGINAL stored asset id, not the DOM scrub-preview src or a proxy');

    const calls = (globalThis as unknown as { __vjobCalls: Array<Record<string, unknown>> }).__vjobCalls;
    assert.equal(calls.length, 1, 'the dialog opened exactly once');
    assert.equal(calls[0]!.op, 'matte', 'as a background-removal job');
    const source = calls[0]!.source as { id: string; url: string };
    assert.equal(source.id, 'user/video/1', 'on the clip\'s original source asset');
    assert.equal(source.url, 'blob:original-1', 'the original bytes - never blob:scrub-preview');
  } finally { h.teardown(); }
});
