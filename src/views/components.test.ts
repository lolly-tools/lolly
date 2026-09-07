// SPDX-License-Identifier: MPL-2.0
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { unzipSync, strFromU8 } from 'fflate';
import { readFileSync } from 'node:fs';
import type { HostV1 } from '@lolly-tools/core/host-v1';

test('library mounts every specimen, filters and resets, keeps navigation local, and downloads a native component', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'http://localhost:5173/#/components', pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const setGlobal = (key: string, value: unknown): void => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'MouseEvent', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMRect', 'XMLSerializer']) setGlobal(key, (dom.window as any)[key]);
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  setGlobal('matchMedia', dom.window.matchMedia);
  setGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  setGlobal('CSS', { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`), supports: () => false });
  (dom.window as any).CSS = globalThis.CSS;
  Object.defineProperty(dom.window.document, 'fonts', { value: { ready: Promise.resolve() } });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  // Geometry is supplied only to exercise the download flow. Browser layout and
  // visual fidelity are outside jsdom's capabilities.
  dom.window.Element.prototype.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 480, 220);
  dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect(20, 20, 100, 20);
  let downloaded: { blob: Blob; filename: string } | undefined;
  let resolveDownload!: () => void;
  const complete = new Promise<void>(resolve => { resolveDownload = resolve; });
  const host = {
    profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {},
    export: { download: async (blob: Blob, filename: string) => { downloaded = { blob, filename }; resolveDownload(); } },
  } as unknown as HostV1;
  const view = document.querySelector<HTMLElement>('#view')!;
  try {
    const { mountComponents } = await import('./components.ts');
    const { COMPONENT_SECTIONS: AUDIT_SECTIONS, COMPONENT_ARTWORK } = await import('./components-data.ts');
    const total = AUDIT_SECTIONS.flatMap(s => s.items).length;
    await mountComponents(view, host);
    assert.equal(view.querySelectorAll('[data-cl-card]').length, total);
    assert.equal(view.querySelectorAll('[data-cl-download]').length, total);
    assert.deepEqual([...view.querySelectorAll('.cl-broken')].map(n => n.textContent), []);
    assert.equal(view.querySelector('.cl-component-section')?.id, 'cl-colour-tools');
    assert.equal(view.querySelector('.cl-stage')?.getAttribute('data-cl-preview'), 'wheel');
    assert.equal(view.querySelectorAll('[data-cl-preview="audioDock"] .audio-dock').length, 1, 'use the production player shell');
    assert.equal(view.querySelector('[data-cl-preview="catSummary"]')?.textContent?.includes('reading…'), false);
    assert.ok(view.querySelector('[data-cl-preview="projectTiles"] .folder-mosaic'));
    assert.ok(view.querySelector('[data-cl-preview="selectionBar"] .projects-bulkbar:not([hidden])'));
    assert.ok(view.querySelector('[data-cl-preview="editableWheel"] [data-be-wheel]'));
    const palette = view.querySelector<HTMLElement>('[data-color-field="cl-color"]')!;
    assert.ok(palette.querySelectorAll('.color-swatches button').length > 0, 'the missing palette must be visible without opening another menu');
    assert.equal(palette.querySelector<HTMLElement>('.color-popover')!.hidden, false);
    const fine = view.querySelector<HTMLElement>('[data-color-field="cl-color-fine"]')!;
    assert.equal(fine.querySelector<HTMLElement>('[data-color-modes]')!.dataset.activeMode, 'hsl');
    assert.equal(fine.querySelectorAll('[role="tab"]').length, 2);
    assert.ok(view.querySelector('[data-color-field="cl-named-1"]'));
    assert.ok(view.querySelector('[data-color-field="cl-compact-1"]'));
    const exampleImages = [...view.querySelectorAll<HTMLImageElement>('.cl-stage img')];
    assert.ok(exampleImages.length > 0);
    for (const img of exampleImages) {
      assert.ok(Object.values(COMPONENT_ARTWORK).some(src => src === img.getAttribute('src')), `invalid example image: ${img.outerHTML}`);
      assert.ok(img.hasAttribute('alt'), 'images have text alternatives; redundant tile thumbnails may be decorative');
    }
    assert.deepEqual(readFileSync(new URL('../../public/icon-primary.svg', import.meta.url)), readFileSync(new URL('../../../../icon-primary.svg', import.meta.url)), 'the shell must ship the real primary icon');
    const heroImage = view.querySelector<HTMLImageElement>('.gtile-hero-img')!;
    heroImage.dispatchEvent(new dom.window.Event('error'));
    assert.equal(heroImage.getAttribute('src'), COMPONENT_ARTWORK.icon, 'profiles without a gradient preview fall back to the shell icon');
    assert.equal(heroImage.classList.contains('cl-example-cover'), false, 'the fallback icon should be contained, not cropped');
    const search = view.querySelector<HTMLInputElement>('.cl-search-input')!;
    search.value = 'zzzzmissing'; search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(view.querySelectorAll('.cl-card:not([hidden])').length, 0);
    assert.equal(view.querySelector<HTMLElement>('.cl-empty')!.hidden, false);
    view.querySelector<HTMLButtonElement>('.cl-reset')!.click();
    assert.equal(view.querySelectorAll('.cl-card:not([hidden])').length, total);
    search.value = 'btn primary'; search.dispatchEvent(new dom.window.Event('input'));
    assert.ok(view.querySelectorAll('.cl-card:not([hidden])').length < total);
    const buttonIndex = AUDIT_SECTIONS.flatMap(s => s.items).findIndex(s => s.name.startsWith('Button system'));
    assert.equal(view.querySelector<HTMLElement>(`[data-cl-card="${buttonIndex}"]`)!.hidden, false);
    const hash = location.hash;
    view.querySelector<HTMLAnchorElement>('[data-cl-jump="cl-tokens"]')!.click();
    assert.equal(location.hash, hash, 'category jumps must not route away');
    assert.equal(document.activeElement?.id, 'cl-tokens');
    const tokenSearch = view.querySelector<HTMLInputElement>('.cl-token-search input')!;
    tokenSearch.value = 'type.display'; tokenSearch.dispatchEvent(new dom.window.Event('input'));
    assert.equal(view.querySelectorAll('[data-cl-token]:not([hidden])').length, 1);
    const button = view.querySelector<HTMLButtonElement>(`[data-cl-download="${buttonIndex}"]`)!;
    button.click();
    assert.equal(button.disabled, true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([complete, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(view.querySelector('.cl-download-status')!.textContent || 'Download timed out')), 5000); })]).finally(() => clearTimeout(timer));
    assert.ok(downloaded);
    assert.match(downloaded.filename, /^lolly-\d+-button-system\.penpot$/);
    const archive = unzipSync(new Uint8Array(await downloaded.blob.arrayBuffer()));
    assert.ok(Object.keys(archive).some(path => path.includes('/components/')));
    const entries = Object.values(archive).map(bytes => JSON.parse(strFromU8(bytes)));
    assert.ok(entries.some(entry => entry.type === 'text' && entry.appliedTokens?.fontSize));
    assert.ok(entries.some(entry => entry.mainInstance === true));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(button.disabled, false);
    assert.match(button.closest('.cl-card-footer')!.textContent!, /File ready/);
    assert.doesNotMatch(button.closest('.cl-card-footer')!.textContent!, /Downloaded\./);
  } finally {
    (view as HTMLElement & { _cleanup?: () => void })._cleanup?.();
    dom.window.close();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
  }
});
