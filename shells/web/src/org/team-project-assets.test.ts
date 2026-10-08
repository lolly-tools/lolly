// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildProjectAsset, prepareProjectAsset, projectAssetHref, teamAssetTiles } from './team-project-assets.ts';
import { createHash } from 'node:crypto';
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

test('an asset page retains the project return path and opens the shared inspector', () => {
  const preview = { link: () => projectAssetHref(file.projectId, file.id), open: () => ({ ready: Promise.resolve(), destroy() {} }) };
  const page = buildProjectAsset(file.projectId, file, undefined, preview);
  assert.equal(page.querySelector('a')?.getAttribute('href'), '#/p?team=prj_1');
  assert.equal(page.querySelector('h3')?.textContent, file.name);
  assert.ok(page.querySelector('[data-asset-preview]'));
  assert.equal(page.querySelector('img'), null);
  assert.equal(page.querySelector('[data-asset-preview] button')?.textContent, 'Preview');
  assert.equal(page.querySelector('a[download]'), null);
  assert.equal(page.querySelector('dialog'), null);
  const movie = buildProjectAsset(file.projectId, { ...file, contentType: 'video/mp4' }, undefined, preview);
  assert.ok(movie.querySelector('[data-asset-preview]'));
  assert.equal(movie.querySelector('video'), null);
  page.dispose(); movie.dispose();
});

test('source documents are available as assets without being loaded as broken images', () => {
  document.body.innerHTML = teamAssetTiles(file.projectId, [{ ...file, contentType: 'application/pdf', name: 'Brief.pdf', asset: { format: 'pdf' } }]);
  assert.equal(document.querySelector('img'), null);
  assert.equal(document.querySelectorAll('[data-open-team-file]').length, 1);
});

test('shared previews verify the bytes, infer the format, and release their temporary URL', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR4sAAAAASUVORK5CYII=', 'base64');
  const remote = { ...file, size: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex'),
    contentType: 'audio/mpeg', asset: { type: 'audio', format: 'mp3', width: 1, height: 1, meta: { name: 'Wrong', tags: 'cover' } } };
  const fetch = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.equal(String(input), '/api/v1/projects/prj_1/files/fil_123');
    return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
  };
  try {
    const preview = await prepareProjectAsset(file.projectId, remote);
    assert.equal(preview.ref.type, 'raster');
    assert.equal(preview.ref.format, 'png');
    assert.equal(preview.ref.meta?.name, file.name);
    assert.deepEqual(preview.ref.meta?.tags, []);
    assert.equal(preview.ref.checksum, remote.checksum);
    assert.deepEqual(new Uint8Array(await (await fetch(preview.ref.url)).arrayBuffer()), new Uint8Array(bytes));
    preview.dispose();
    await assert.rejects(fetch(preview.ref.url));
    await assert.rejects(prepareProjectAsset(file.projectId, { ...remote, checksum: 'b'.repeat(64) }));
  } finally { globalThis.fetch = fetch; }
});
