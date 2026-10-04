// SPDX-License-Identifier: MPL-2.0
/**
 * Brand looks on the user's own photos, in the asset picker (plan 291 W7).
 *
 * A look is `?treatment=<lookId>` on an image id, and that includes an upload
 * (`user/media/<sha256>?treatment=<lookId>`). The picker used to mount the look
 * strip only inside Catalogue groups, so a Design image layer whose picture was an
 * upload with a look reopened on the Private assets tab with no way to change or
 * clear that look: the strip's buttons existed, on the hidden Catalogue pane only.
 *
 * These cases run the real `openPicker` in jsdom with an in-memory host and read
 * the answer off the rendered DOM and the id the picker resolves.
 *
 * Run directly:  node --test shells/web/src/views/picker-upload-looks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLImageElement',
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
(dom.window as unknown as Record<string, unknown>).__toolIndex = { tools: [] };

const { openPicker } = await import('./picker.ts');

const UPLOAD = 'user/media/0123abcd';
const upload: AssetRef = { id: UPLOAD, type: 'raster', url: 'blob:upload', meta: { name: 'Clock photo' } } as unknown as AssetRef;
const LOOKS = [
  { id: 'tone', label: 'Tone', kind: 'duotone', shadow: '#0c322c', highlight: '#ffffff' },
  { id: 'greyscale', label: 'Greyscale', kind: 'greyscale' },
];

function makeHost(catalog: AssetRef[], got: string[]) {
  return {
    capabilities: [],
    log() {},
    profile: { get: async () => ({}), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    compose: { render: async () => null, renderUrl: async () => null, _describeUrl: async () => null },
    assets: {
      query: async () => catalog,
      get: async (id: string) => { got.push(id); return { ...upload, id }; },
      isAvailable: async () => true,
      _listUserAssets: async () => [upload],
      _userAssetsCount: async () => 1,
      _deleteUserAsset: async () => {},
      _iconThemes: async () => [],
      _photoTreatments: async () => LOOKS,
      _uploadUserAsset: async () => {},
    },
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise<void>(r => setTimeout(r, 0));
}

const click = (el: Element) => el.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));

/** Open the picker the way the Design image inspector does for an upload with a look. */
async function openOnUpload(catalog: AssetRef[]) {
  const got: string[] = [];
  const done = openPicker(makeHost(catalog, got) as never, {
    type: 'image', allowUpload: true, initialTab: 'uploads', current: `${UPLOAD}?treatment=tone`,
  } as never);
  await settle();
  const pane = document.querySelector<HTMLElement>('.asset-picker-pane[data-pane="uploads"]');
  assert.ok(pane && !pane.hidden, 'the Private assets pane is the one showing');
  return { pane: pane!, done, got };
}

const pressed = (pane: HTMLElement) =>
  [...pane.querySelectorAll<HTMLElement>('[data-treatment-id]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.treatmentId);

for (const [name, catalog] of [
  ['with photos in the Catalogue', [{ id: 'lolly/photo/hills', type: 'raster', url: 'blob:hills', meta: { name: 'Hills', tags: ['photo'] } }]],
  ['with no photos in the Catalogue', [{ id: 'lolly/logo/primary', type: 'vector', url: 'blob:logo', meta: { name: 'Logo', tags: ['logo'] } }]],
] as unknown as Array<[string, AssetRef[]]>) {
  test(`an upload's look is shown and can be cleared on the Private assets tab (${name})`, async () => {
    const { pane, done, got } = await openOnUpload(catalog);
    assert.deepEqual(pressed(pane), ['tone'], 'the strip sits on the uploads pane with the current look pressed');
    click(pane.querySelector('[data-treatment-id=""]')!);
    assert.deepEqual(pressed(pane), [''], 'None is pressed after the switch');
    click(pane.querySelector(`[data-asset-id="${UPLOAD}"]`)!);
    const ref = await done;
    assert.equal(ref?.id, UPLOAD, 'picking the upload with None resolves the plain photo');
    assert.deepEqual(got, [UPLOAD]);
    await settle();
  });
}

test('another look picked for an upload rides in the picked id', async () => {
  const { pane, done, got } = await openOnUpload([]);
  click(pane.querySelector('[data-treatment-id="greyscale"]')!);
  const img = pane.querySelector<HTMLImageElement>(`[data-asset-id="${UPLOAD}"] img`);
  assert.match(img?.style.filter ?? '', /greyscale/, 'the upload thumbnail previews the chosen look');
  click(pane.querySelector(`[data-asset-id="${UPLOAD}"]`)!);
  const ref = await done;
  assert.equal(ref?.id, `${UPLOAD}?treatment=greyscale`);
  assert.deepEqual(got, [`${UPLOAD}?treatment=greyscale`]);
  await settle();
});
