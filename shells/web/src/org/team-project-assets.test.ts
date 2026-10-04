// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildProjectAsset, projectAssetHref, teamAssetTiles } from './team-project-assets.ts';
import type { TeamFile } from './team-files.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
globalThis.document = dom.window.document;
const file: TeamFile = { id: 'fil_123', projectId: 'prj_1', name: 'Poster <review>.jpeg', size: 1234,
  checksum: 'a'.repeat(64), contentType: 'image/jpeg', ready: true, asset: { type: 'raster', format: 'jpeg' } };

test('shared assets use the folder card and a direct page route with safely rendered names', () => {
  document.body.innerHTML = teamAssetTiles(file.projectId, [file]);
  const card = document.querySelector('.folder-tile[data-kind="team-file"]')!;
  const link = card.querySelector<HTMLAnchorElement>('[data-open-team-file]')!;
  assert.equal(link.tagName, 'A');
  assert.equal(link.getAttribute('href'), projectAssetHref(file.projectId, file.id));
  assert.equal(link.getAttribute('aria-label'), 'Open shared asset Poster <review>.jpeg');
  assert.equal(card.querySelector('review'), null);
  assert.equal(card.querySelector('img')?.getAttribute('src'), '/api/v1/projects/prj_1/files/fil_123');
  assert.equal(document.querySelector('dialog'), null);
});

test('an asset page retains the project return path and previews files without a modal', () => {
  const page = buildProjectAsset(file.projectId, file);
  assert.equal(page.querySelector('a')?.getAttribute('href'), '#/p?team=prj_1');
  assert.equal(page.querySelector('h3')?.textContent, file.name);
  assert.equal(page.querySelector('img')?.getAttribute('src'), '/api/v1/projects/prj_1/files/fil_123');
  assert.equal(page.querySelector('a[download]')?.getAttribute('download'), file.name);
  assert.equal(page.querySelector('dialog'), null);
  const movie = buildProjectAsset(file.projectId, { ...file, contentType: 'video/mp4' });
  assert.equal(movie.querySelector('video')?.preload, 'none');
  assert.equal(movie.querySelector('video')?.controls, true);
});

test('source documents are available as assets without being loaded as broken images', () => {
  document.body.innerHTML = teamAssetTiles(file.projectId, [{ ...file, contentType: 'application/pdf', name: 'Brief.pdf', asset: { format: 'pdf' } }]);
  assert.equal(document.querySelector('img'), null);
  assert.equal(document.querySelectorAll('[data-open-team-file]').length, 1);
});
