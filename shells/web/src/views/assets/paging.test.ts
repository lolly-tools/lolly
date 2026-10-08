// SPDX-License-Identifier: MPL-2.0
// A large library must not build what nobody is looking at: a folded group's tiles
// are built when it opens, and Show more appends a page instead of repainting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { CatCtx } from './context.ts';
import { groupSection } from './tiles.ts';
import { appendPage, expandDeferred } from './sections.ts';
import { ASSET_PAGE_SIZE, showMoreHtml } from './shared.ts';

const refs = (n: number): AssetRef[] => Array.from({ length: n }, (_, i) => ({ source: 'library', id: `a${i}`, type: 'vector', format: 'svg', url: `/a${i}.svg` }) as AssetRef);

function fakeCat(doc: Document): { cat: CatCtx; tiles: () => number; repaints: () => number } {
  let tiles = 0, repaints = 0;
  const viewEl = doc.createElement('div');
  const cat = {
    collapsed: new Set<string>(), query: '', deferredBodies: new Map(), assetPageItems: new Map(), assetPageSizes: new Map(),
    viewEl, mounted: false,
    thumbs: { assetTile: (ref: AssetRef) => { tiles++; return `<div class="cat-tile"><button class="cat-tile-open" data-open="${ref.id}"></button></div>`; } },
    wiring: { reapplyTreatment: () => { repaints++; } },
  } as unknown as CatCtx;
  return { cat, tiles: () => tiles, repaints: () => repaints };
}

test('a folded group keeps a placeholder and builds its tiles once, when opened', () => {
  const dom = new JSDOM('<body></body>');
  const { cat } = fakeCat(dom.window.document);
  cat.collapsed.add('icons');
  let builds = 0;
  const html = groupSection(cat, 'icons', 'Icons', 500, () => { builds++; return '<div class="cat-grid"><i></i></div>'; });
  assert.equal(builds, 0, 'nothing is built for a folded group');
  assert.match(html, /data-cat-deferred/);
  dom.window.document.body.innerHTML = html;
  const section = dom.window.document.querySelector('.cat-group')!;
  assert.equal(expandDeferred(cat, section), true);
  assert.equal(builds, 1);
  assert.ok(section.querySelector('.cat-grid i'));
  assert.equal(section.querySelector('[data-cat-deferred]'), null);
  assert.equal(expandDeferred(cat, section), false, 'a second open builds nothing');

  cat.query = 'logo';
  let searched = 0;
  groupSection(cat, 'icons', 'Icons', 500, () => { searched++; return ''; });
  assert.equal(searched, 1, 'a search opens every group, so its body is built at once');
});

test('Show more appends the next page beside the tiles already drawn', () => {
  const dom = new JSDOM('<body></body>');
  const { cat, tiles } = fakeCat(dom.window.document);
  const items = refs(ASSET_PAGE_SIZE * 2 + 5);
  cat.assetPageItems.set('scope', items);
  const body = dom.window.document.body;
  body.innerHTML = `<div class="cat-grid">${items.slice(0, ASSET_PAGE_SIZE).map(r => cat.thumbs.assetTile(r)).join('')}</div>${showMoreHtml('scope', ASSET_PAGE_SIZE, items.length)}`;
  const firstTile = body.querySelector('.cat-tile');
  const drawn = tiles();
  const focus = appendPage(cat, body.querySelector<HTMLElement>('[data-cat-more]')!);
  assert.equal(tiles() - drawn, ASSET_PAGE_SIZE, 'only the new page is rendered');
  assert.equal(body.querySelectorAll('.cat-tile').length, ASSET_PAGE_SIZE * 2);
  assert.equal(body.querySelector('.cat-tile'), firstTile, 'the first page was not rebuilt');
  assert.equal(focus?.dataset.open, `a${ASSET_PAGE_SIZE}`, 'focus lands on the first new tile');
  assert.equal(cat.assetPageSizes.get('scope'), ASSET_PAGE_SIZE * 2, 'a later repaint keeps the longer page');
  const next = body.querySelector<HTMLElement>('[data-cat-more]')!;
  assert.equal(next.dataset.shown, String(ASSET_PAGE_SIZE * 2));
  appendPage(cat, next);
  assert.equal(body.querySelectorAll('.cat-tile').length, items.length);
  assert.equal(body.querySelector('[data-cat-more]'), null, 'the button goes once the grid is complete');
});
