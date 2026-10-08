// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { SVG_TILE_MAX_BYTES, installThumbFallback, isSvgRef, swapToFallback, thumbImgHtml, thumbSources, versionedTileUrl } from './asset-thumb-src.ts';

const svg: AssetRef = {
  source: 'library', id: 'lolly/logo/primary', type: 'vector', format: 'svg', url: '/catalog/assets/logo.svg', version: '3',
  width: 240, height: 80, meta: { name: 'Logo', thumbUrl: '/catalog/assets/logo.thumb.webp', size: 4_000 },
};
const photo: AssetRef = {
  source: 'library', id: 'lolly/photo/hero', type: 'raster', format: 'jpg', url: '/catalog/assets/hero.jpg', version: '1',
  width: 4000, height: 3000, meta: { name: 'Hero', thumbUrl: '/catalog/assets/hero.thumb.webp', size: 9_000_000 },
};

test('a vector tile draws its own SVG and keeps the raster thumb only as the fallback', () => {
  assert.deepEqual(thumbSources(svg), { src: '/catalog/assets/logo.svg', vector: true, fallback: '/catalog/assets/logo.thumb.webp' });
  assert.ok(isSvgRef({ format: 'SVG' }), 'the format match ignores case');
  const html = thumbImgHtml(svg, 'cat-thumb');
  assert.match(html, /src="\/catalog\/assets\/logo\.svg"/);
  assert.match(html, /data-thumb-fallback="\/catalog\/assets\/logo\.thumb\.webp"/);
  assert.match(html, /loading="lazy" decoding="async" width="240" height="80"/);
});

test('an oversized SVG draws its raster thumb, and an SVG with no thumb still draws itself', () => {
  const heavy = { ...svg, meta: { ...svg.meta, size: SVG_TILE_MAX_BYTES + 1 } };
  assert.deepEqual(thumbSources(heavy), { src: '/catalog/assets/logo.thumb.webp', vector: false });
  const heavyNoThumb = { ...heavy, meta: { ...heavy.meta, thumbUrl: undefined } };
  assert.deepEqual(thumbSources(heavyNoThumb), { src: '/catalog/assets/logo.svg', vector: true });
  const unknownSize = { ...svg, meta: { ...svg.meta, size: undefined } };
  assert.equal(thumbSources(unknownSize).src, '/catalog/assets/logo.svg', 'an unknown size is not a reason to blur the logo');
});

test('a raster keeps the small thumb in tiles and the exact bytes where asked', () => {
  assert.deepEqual(thumbSources(photo), { src: '/catalog/assets/hero.thumb.webp', vector: false });
  assert.deepEqual(thumbSources(photo, { preferThumb: false }), { src: '/catalog/assets/hero.jpg', vector: false });
  const noThumb = { ...photo, meta: { name: 'Hero' } };
  assert.equal(thumbSources(noThumb).src, '/catalog/assets/hero.jpg');
  assert.doesNotMatch(thumbImgHtml(photo, 'x'), /data-thumb-fallback/, 'a raster thumb never falls back to a full-size original');
});

test('connected-library tile URLs name the entry version; other URLs are left alone', () => {
  const ext: AssetRef = { ...svg, id: 'ext/bf/a1', url: '/catalog/ext/bf/a1/att9', version: 'abc123def4567890', meta: { provider: 'bf', thumbUrl: '/catalog/ext/bf/a1/thumb' } };
  assert.deepEqual(thumbSources(ext), { src: '/catalog/ext/bf/a1/att9?v=abc123def4567890', vector: true, fallback: '/catalog/ext/bf/a1/thumb?v=abc123def4567890' });
  assert.equal(versionedTileUrl('/catalog/ext/bf/a1/att9?preview=1', ext), '/catalog/ext/bf/a1/att9?preview=1', 'a URL with its own query is untouched');
  assert.equal(versionedTileUrl('/catalog/assets/logo.svg', svg), '/catalog/assets/logo.svg', 'pack assets are not provider assets');
  assert.equal(versionedTileUrl('/catalog/ext/bf/a1/att9', { ...ext, version: undefined }), '/catalog/ext/bf/a1/att9');
});

test('markup is escaped and dimensions are only stated when both are sane', () => {
  const hostile = { ...svg, url: '/x.svg" onerror="alert(1)', width: Number.NaN };
  const html = thumbImgHtml(hostile, 'cat-thumb');
  assert.doesNotMatch(html, /" onerror="/);
  assert.doesNotMatch(html, /width=/);
});

test('a failed SVG tile swaps to its fallback once, through one capture listener', () => {
  const dom = new JSDOM('<body><div id="grid"></div></body>');
  const doc = dom.window.document;
  installThumbFallback(doc as unknown as Document);
  const grid = doc.getElementById('grid')!;
  grid.innerHTML = thumbImgHtml(svg, 'cat-thumb');
  const img = grid.querySelector('img')!;
  img.dispatchEvent(new dom.window.Event('error'));
  assert.equal(img.getAttribute('src'), '/catalog/assets/logo.thumb.webp');
  assert.equal(img.hasAttribute('data-thumb-fallback'), false, 'the swap happens once, so a failing fallback cannot loop');
  assert.equal(swapToFallback(img as unknown as EventTarget), false);
  assert.equal(swapToFallback(null), false);
});
