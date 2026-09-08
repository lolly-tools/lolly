// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's per-VIDEO-card "Remove background" affordance (plan 124 WP-G).
 *
 * The picker already offered the STILL cut-out on raster cards (data-matte-id →
 * openMatteDialog). This adds the video sibling: a video card gets a data-vidmatte-id
 * button that opens the shared VIDEO-job dialog (op 'matte') to make a transparent
 * alternative asset on-device. The claims worth locking down:
 *   - the affordance is offered on a VIDEO card and NOT on a still raster (the still
 *     keeps its own data-matte-id; the two never appear on the same card);
 *   - it is gated on the SAME capability the catalog detail modal uses - video decode
 *     (WebCodecs' VideoDecoder) AND a staged matte model - so it is absent when either
 *     is missing;
 *   - clicking it opens openVideoJobDialog with op:'matte' and THIS video as the source.
 *
 * The dialog module is stubbed (a spy) so no background job runs; everything else is the
 * real openPicker in jsdom against an in-memory host.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/picker-video-matte.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';

// picker.ts imports its own stylesheet (the lazy-view pattern) and dynamically imports
// the video-job dialog on click. Node resolves neither: stub the CSS to an empty module,
// and substitute a SPY for the dialog so the test observes the call without running a job.
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

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
// jsdom implements neither; the picker opens through mountModal (showModal). Same shim as picker-initial-tab.test.ts.
dom.window.HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLImageElement', 'HTMLVideoElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DOMParser',
  'getComputedStyle', 'MutationObserver', 'IntersectionObserver',
]) {
  const v = (dom.window as unknown as Record<string, unknown>)[k];
  if (v !== undefined) (globalThis as Record<string, unknown>)[k] = v;
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!(globalThis as Record<string, unknown>).IntersectionObserver) {
  (globalThis as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const { openPicker } = await import('./picker.ts');

// ── fixture ───────────────────────────────────────────────────────────────────

const asset = (id: string, type = 'raster'): AssetRef => ({
  id, type, url: `blob:${id}`, meta: { name: id },
} as unknown as AssetRef);

/** A staged matte model, exactly what host.matte.models() returns once one is verified. */
const STAGED_MATTE = { matte: { isAvailable: () => true, models: () => [{ id: 'u2netp' }] } };

function makeHost(userAssets: AssetRef[], matte = STAGED_MATTE.matte) {
  return {
    capabilities: [],
    log() {},
    matte,
    profile: { get: async () => ({}), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    compose: { render: async () => null, renderUrl: async () => null, _describeUrl: async () => null },
    assets: {
      query: async () => [],
      // The pick path resolves an id to a ref; a user video lives in the user list.
      get: async (id: string) => userAssets.find(a => a.id === id) ?? null,
      isAvailable: async () => true,
      _listUserAssets: async () => userAssets,
      _userAssetsCount: async () => userAssets.length,
      _deleteUserAsset: async () => {},
      _iconThemes: async () => [],
      _photoTreatments: async () => [],
      _uploadUserAsset: async () => {},
    },
  };
}

/** Let the picker's async render (profile + user list + folders) land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise<void>(r => setTimeout(r, 0));
}

function panel(): HTMLElement {
  const p = dom.window.document.querySelector<HTMLElement>('.asset-picker-panel');
  assert.ok(p, 'the picker mounted a panel');
  return p!;
}
function closePicker(): void {
  panel().querySelector<HTMLButtonElement>('.asset-picker-close')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
}

// ── the affordance is offered on a video, and only on a video ──────────────────

test('a VIDEO card gets Remove-background; a still raster gets the STILL cut-out, never the video one', async () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: [] };
  const video = asset('user/video/clip', 'video');
  const still = asset('user/images/photo', 'raster');
  const done = openPicker(makeHost([video, still]) as never, { allowUpload: true } as never);
  await settle();
  const p = panel();

  const vidCard = p.querySelector<HTMLElement>(`[data-asset-id="${video.id}"]`)!.closest('.asset-picker-card')!;
  assert.ok(vidCard.querySelector(`[data-vidmatte-id="${video.id}"]`), 'the video card offers Remove background (video-job dialog)');
  assert.equal(vidCard.querySelector('[data-matte-id]'), null, 'and NOT the still cut-out - a video is not a still');

  const stillCard = p.querySelector<HTMLElement>(`[data-asset-id="${still.id}"]`)!.closest('.asset-picker-card')!;
  assert.ok(stillCard.querySelector(`[data-matte-id="${still.id}"]`), 'the still raster keeps its own data-matte-id path');
  assert.equal(stillCard.querySelector('[data-vidmatte-id]'), null, 'and never grows the video affordance');

  closePicker();
  assert.equal(await done, null);
  await settle();
});

// ── the capability gate ────────────────────────────────────────────────────────

test('no staged matte model still offers video Remove-background (the colour key is model-free)', async () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: [] };
  const video = asset('user/video/clip', 'video');
  // matte present but NO model staged (models() empty): the video path still offers
  // Remove-background, because the shared dialog's deterministic COLOUR-KEY method needs
  // no model. Only the STILL raster cut-out (matteEnabled) stays gated on a staged model.
  const done = openPicker(makeHost([video], { isAvailable: () => true, models: () => [] }) as never, { allowUpload: true } as never);
  await settle();
  assert.ok(panel().querySelector('[data-vidmatte-id]'), 'the model-free colour key keeps the affordance live');
  closePicker();
  assert.equal(await done, null);
  await settle();
});

test('no VideoDecoder → no Remove-background on a video card, even with a staged model', async () => {
  delete (dom.window as unknown as Record<string, unknown>).VideoDecoder;
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: [] };
  const video = asset('user/video/clip', 'video');
  const done = openPicker(makeHost([video]) as never, { allowUpload: true } as never);
  await settle();
  assert.equal(panel().querySelector('[data-vidmatte-id]'), null, 'the browser cannot decode video → no video matte');
  closePicker();
  assert.equal(await done, null);
  await settle();
});

// ── the dispatch: op:'matte' on THIS video ─────────────────────────────────────

test('clicking Remove-background opens the video-job dialog with op:matte and THIS video as the source', async () => {
  (dom.window as unknown as Record<string, unknown>).VideoDecoder = class {};
  (dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: [] };
  (globalThis as unknown as { __vjobCalls?: unknown[] }).__vjobCalls = [];
  const video = asset('user/video/clip', 'video');
  const done = openPicker(makeHost([video]) as never, { allowUpload: true } as never);
  await settle();

  const btn = panel().querySelector<HTMLButtonElement>(`[data-vidmatte-id="${video.id}"]`)!;
  assert.ok(btn, 'the video Remove-background button rendered');
  btn.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();

  const calls = (globalThis as unknown as { __vjobCalls: Array<Record<string, unknown>> }).__vjobCalls;
  assert.equal(calls.length, 1, 'the dialog opened exactly once');
  assert.equal(calls[0]!.op, 'matte', 'as a background-removal job');
  assert.equal((calls[0]!.source as AssetRef).id, video.id, 'on THIS video, resolved via host.assets.get');
  assert.equal(typeof calls[0]!.onComplete, 'function', 'with a completion hook, so the result behaves like a normal pick');

  closePicker();
  await done;
  await settle();
});
