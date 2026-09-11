// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { unzipSync } from 'fflate';
import { readJson } from '../bundle.ts';
import type { BrandPackageHost } from './brand-package.ts';

test('download dialog starts with brand only; search, selection, mode switching and cancellation stay scoped', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost:5173/#/profile' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'history', 'location', 'Element', 'HTMLElement', 'CustomEvent', 'localStorage']) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as any)[key] });
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const headId = 'user/ds/acme/tokens/brand';
  const tokens = new Blob([JSON.stringify({ color: { primary: { $type: 'color', $value: '#285540' } } })]);
  const image = { id: 'user/upload/photo', type: 'raster', format: 'png', blob: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 0, 0])], { type: 'image/png' }), meta: { name: 'Photo <img src=x>' } };
  let reads = 0;
  const downloads: Blob[] = [];
  const host = {
    designSystems: { get: async () => ({ id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId, source: { kind: 'local' } }) },
    assets: {
      _getBlob: async (id: string) => id === headId ? tokens : image.blob,
      _exportUserAssets: async () => [image],
      _listUserAssets: async () => [{ ...image, source: 'user', url: '' }],
      query: async () => [],
    },
    state: { list: async () => { reads++; return [{ slot: 'poster:one', toolId: 'poster', label: 'Spring poster' }]; }, load: async () => ({ __toolId: 'poster', title: 'Spring' }) },
    export: { download: async (blob: Blob) => { downloads.push(blob); } },
  } as unknown as BrandPackageHost;
  const until = async (condition: () => boolean) => {
    for (let n = 0; n < 100 && !condition(); n++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(condition(), document.querySelector('.bd-status')?.textContent || 'UI did not settle');
  };
  try {
    const { openBrandDownload } = await import('./brand-download.ts');
    let closed = openBrandDownload(host, 'acme');
    await until(() => !!document.querySelector('dialog'));
    let dialog = document.querySelector('dialog')!;
    assert.equal(reads, 0, 'opening the default must not enumerate personal content');
    dialog.querySelector<HTMLButtonElement>('[data-bd-download]')!.click();
    dialog.querySelector<HTMLButtonElement>('[data-bd-download]')!.click();
    await until(() => downloads.length === 1 && !dialog.querySelector<HTMLButtonElement>('[data-bd-download]')!.disabled);
    assert.equal(readJson(unzipSync(new Uint8Array(await downloads[0]!.arrayBuffer())), 'content.json'), null);
    dialog.querySelector<HTMLButtonElement>('[data-bd-close]')!.click(); await closed;
    closed = openBrandDownload(host, 'acme'); await until(() => !!document.querySelector('dialog'));
    dialog = document.querySelector('dialog')!;
    dialog.querySelector<HTMLInputElement>('[value="collection"]')!.click();
    await until(() => dialog.querySelectorAll('[data-bd-choice]').length === 2);
    assert.equal(dialog.querySelectorAll('[type="checkbox"]:checked').length, 0);
    assert.equal(dialog.querySelectorAll('img').length, 0, 'device labels must be escaped');
    const search = dialog.querySelector<HTMLInputElement>('[type="search"]')!;
    search.value = 'Photo'; search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(dialog.querySelectorAll('[data-bd-item]:not([hidden])').length, 1);
    dialog.querySelector<HTMLButtonElement>('[data-bd-select="assets"]')!.click();
    assert.match(dialog.querySelector('.bd-summary')!.textContent!, /0 sessions · 1 files · 0 tools/);
    dialog.querySelector<HTMLInputElement>('[value="brand"]')!.click();
    assert.equal(dialog.querySelector('.bd-summary')!.textContent, 'Brand only');
    dialog.querySelector<HTMLInputElement>('[value="collection"]')!.click();
    assert.match(dialog.querySelector('.bd-summary')!.textContent!, /1 files/);
    dialog.querySelector<HTMLButtonElement>('[data-bd-download]')!.click();
    await until(() => downloads.length === 2);
    const manifest = readJson(unzipSync(new Uint8Array(await downloads[1]!.arrayBuffer())), 'manifest.json');
    assert.deepEqual(manifest.contents, { sessions: 0, assets: 1, tools: 0, references: 0 });
    dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true })); await closed;
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(downloads.length, 2);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 10));
    dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
  }
});
