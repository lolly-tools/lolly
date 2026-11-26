// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's pinned sections (views/picker.ts): a partner kit's marks first
 * (plans/82 M8), then Recent and Favourites. Each pinned section repaints its cards
 * through the same refresh the library uses, so a tile the slot cannot take is dimmed
 * there too, not only in the library.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/picker-partner-marks.test.ts
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
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLImageElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DOMParser',
  'getComputedStyle', 'MutationObserver', 'IntersectionObserver', 'localStorage',
]) {
  const v = (dom.window as unknown as Record<string, unknown>)[k];
  if (v !== undefined) (globalThis as Record<string, unknown>)[k] = v;
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!(globalThis as Record<string, unknown>).IntersectionObserver) {
  (globalThis as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const { openPicker } = await import('./picker.ts');
const { setCurrentPiece, setPieceState } = await import('../lib/partner-kit-state.ts');

const asset = (id: string, type = 'raster'): AssetRef => ({ id, type, url: `blob:${id}`, meta: { name: id, tags: ['photo'] } } as unknown as AssetRef);
const ASSETS = [asset('a/one'), asset('a/clip', 'video'), asset('inst/nw-light', 'vector'), asset('inst/nw-mark', 'vector')];

function makeHost(favourites: string[] = []) {
  return {
    capabilities: [], log() {},
    profile: { get: async () => ({ favouriteAssets: favourites }), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    compose: { render: async () => null, renderUrl: async () => null, _describeUrl: async () => null },
    assets: {
      query: async () => ASSETS, get: async (id: string) => ASSETS.find((a) => a.id === id) ?? null, isAvailable: async () => true,
      _listUserAssets: async () => [], _userAssetsCount: async () => 0, _deleteUserAsset: async () => {},
      _iconThemes: async () => [], _photoTreatments: async () => [], _uploadUserAsset: async () => {},
    },
  };
}
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((r) => setTimeout(r, 0)); };
const closePicker = async (): Promise<void> => {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  for (const n of dom.window.document.querySelectorAll('.asset-picker-panel, dialog')) n.remove();
};

const KIT = {
  schemaVersion: 1 as const, id: 'northwind-it', label: 'Northwind IT',
  logos: { light: { id: 'inst/nw-light', version: 2 }, mark: { id: 'inst/nw-mark', version: 1 } }, colours: [],
};

test('a piece with a partner kit gets the kit\'s marks first, under Partner', async () => {
  const runtime = {};
  setPieceState(runtime, { attachment: { id: 'inst/kit', revision: 2 }, kit: KIT });
  setCurrentPiece(runtime);
  try {
    void openPicker(makeHost() as never, { type: 'image' } as never);
    await settle();
    const panel = dom.window.document.querySelector<HTMLElement>('.asset-picker-panel')!;
    const partner = panel.querySelector<HTMLElement>('.asset-picker-partner')!;
    assert.equal(partner.hidden, false);
    assert.match(partner.textContent ?? '', /Partner/);
    assert.deepEqual([...partner.querySelectorAll<HTMLElement>('[data-asset-id]')].map((el) => el.dataset.assetId), ['inst/nw-light', 'inst/nw-mark']);
    assert.ok(partner.compareDocumentPosition(panel.querySelector('.asset-picker-recents')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'Partner comes before Recent');
    await closePicker();
  } finally {
    setCurrentPiece(null);
  }
});

test('without a kit there is no Partner section, and Recent and Favourites dim a tile the slot cannot take', async () => {
  localStorage.setItem('lolly:recentAssets', JSON.stringify(['a/clip', 'a/one']));
  try {
    void openPicker(makeHost(['a/clip']) as never, { type: 'image' } as never);
    await settle();
    const panel = dom.window.document.querySelector<HTMLElement>('.asset-picker-panel')!;
    assert.equal(panel.querySelector<HTMLElement>('.asset-picker-partner')!.hidden, true);
    for (const section of ['.asset-picker-recents', '.asset-picker-favourites']) {
      const el = panel.querySelector<HTMLElement>(section)!;
      assert.equal(el.hidden, false, `${section} shows`);
      const clip = el.querySelector<HTMLElement>('[data-asset-id="a/clip"]');
      assert.ok(clip, `${section} holds the clip`);
      assert.equal(clip!.getAttribute('aria-disabled'), 'true', `${section} dims the clip an image slot cannot take`);
    }
    assert.equal(panel.querySelector<HTMLElement>('.asset-picker-recents [data-asset-id="a/one"]')!.hasAttribute('aria-disabled'), false);
    await closePicker();
  } finally {
    localStorage.removeItem('lolly:recentAssets');
  }
});
