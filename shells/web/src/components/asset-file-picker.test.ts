// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountAssetFilePicker } from './asset-file-picker.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
test('inspection preserves same-format file choices until Use this file commits', async () => {
  const dom = new JSDOM('<div id="card"></div>', { url: 'https://lolly.tools' }); Object.assign(globalThis, { document: dom.window.document });
  const card = document.querySelector<HTMLElement>('#card')!; let picked = '';
  const ref: AssetRef = { id: 'ext/a/logo', source: 'library', type: 'raster', format: 'png', url: '/catalog/ext/a/logo/first', meta: { assetFiles: [{ id: '000000000000000000000001', format: 'png', url: '/catalog/ext/a/logo/first', name: 'First.png' }, { id: '000000000000000000000002', format: 'png', url: '/catalog/ext/a/logo/second', name: 'Second.png' }] } };
  const handle = mountAssetFilePicker(card, ref, { back() {}, current: () => true, accepts: () => true, resolve: async file => file, picked: async file => { picked = file.url; return true; } });
  (card.querySelectorAll<HTMLButtonElement>('.asset-file-choice')[1]!).click(); await Promise.resolve(); assert.equal(picked, '');
  const use = [...card.querySelectorAll('button')].find(b => b.textContent === 'Use this file')!; use.click(); await new Promise(r => setImmediate(r)); assert.equal(picked, '/catalog/ext/a/logo/second'); handle.destroy(); dom.window.close();
});
