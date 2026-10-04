// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildLocalProjectAsset, localProjectAssetHref, mountLocalProjectAsset } from './projects-asset-view.ts';
import { buildProjectAssetPage } from '../components/project-asset-page.ts';
import { imageTile } from '../folder-tiles.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
globalThis.document = dom.window.document;

test('local folder asset cards have refreshable routes and the same page as shared assets', () => {
  const asset: AssetRef = { id: 'ext/provider/asset', source: 'library', type: 'raster', format: 'jpeg', url: '/catalog/image.jpeg', meta: { name: 'Cover <review>.jpeg' } };
  const href = localProjectAssetHref('folder one', asset.id);
  document.body.innerHTML = imageTile(asset, { href });
  assert.equal(document.querySelector('a')?.getAttribute('href'), '#/p/folder%20one?asset=ext%2Fprovider%2Fasset');
  const page = buildLocalProjectAsset({} as HostV1, 'folder one', asset);
  assert.ok(page.classList.contains('project-asset-page'));
  assert.equal(page.querySelector('a')?.getAttribute('href'), '#/p/folder%20one');
  assert.equal(page.querySelector('h3')?.textContent, asset.meta?.name);
  assert.equal(page.querySelector('img')?.getAttribute('src'), asset.url);
  assert.equal(page.querySelector('dialog'), null);
});

test('the asset page prevents repeated downloads and lets a failed save be retried', async () => {
  let attempts = 0;
  const page = buildProjectAssetPage({ name: 'Cover.jpeg', url: '/cover.jpeg', contentType: 'image/jpeg', backHref: '#/p',
    async download() { attempts++; throw Error('offline'); }, downloadError: () => 'Try again when connected.' });
  document.body.replaceChildren(page);
  const download = page.querySelector('button')!;
  download.click(); assert.equal(download.disabled, true); download.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(attempts, 1); assert.equal(download.disabled, false);
  assert.equal(page.querySelector('[role="status"]')?.textContent, 'Try again when connected.');
  download.click(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(attempts, 2);
});

test('an asset outside the addressed folder has a clear return path', () => {
  const view = document.createElement('div'); view.innerHTML = '<div class="projects-grid"></div>';
  mountLocalProjectAsset(view, {} as HostV1, 'folder one', 'missing', [], new Map());
  assert.match(view.textContent!, /This asset is unavailable/);
  assert.equal(view.querySelector('a')?.getAttribute('href'), '#/p/folder%20one');
  assert.equal(view.querySelector('img'), null);
});
