// SPDX-License-Identifier: MPL-2.0
/**
 * The icon colours a colourway offers follow the ground the assets sit on: a colourway's
 * own pairing on a light ground and its pairing for a dark ground on a dark one. These
 * pin the two rules the view applies (views/assets/shared.ts) and the move itself, in a
 * real DOM: the swatches of a strip and a group's chosen pair change with the ground.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { IconTheme } from '../../../../../engine/src/icon-theme.ts';

const LIGHT: IconTheme[] = [
  { id: 'colourway-jungle', label: 'Jungle', c1: '#30ba78', c2: '#0c322c' },
  { id: 'colourway-eu-policy', label: 'EU policy', c1: '#90ebcd', c2: '#192072' },
];
const DARK: IconTheme[] = [
  { id: 'colourway-jungle--on-dark', label: 'Jungle', c1: '#90ebcd', c2: '#30ba78' },
  { id: 'colourway-eu-policy--on-dark', label: 'EU policy', c1: '#ffffff', c2: '#90ebcd' },
];
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs><path class="c1" d="M0 0h4v8H0z"/><path class="c2" d="M4 0h4v8H4z"/></svg>';

function dom(theme: 'light' | 'dark' = 'light') {
  const env = new JSDOM(`<!doctype html><html data-theme="${theme}"><body></body></html>`, { url: 'http://localhost/#/assets' });
  const g = globalThis as Record<string, unknown>;
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'localStorage', 'getComputedStyle'] as const) {
    Object.defineProperty(g, key, { value: (env.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  return env;
}

test('a colourway look names its pairing for each ground; any other id is left alone', async () => {
  dom();
  const { iconThemeForGround } = await import('./shared.ts');
  assert.equal(iconThemeForGround('colourway-jungle', 'dark'), 'colourway-jungle--on-dark');
  assert.equal(iconThemeForGround('colourway-jungle--on-dark', 'dark'), 'colourway-jungle--on-dark');
  assert.equal(iconThemeForGround('colourway-jungle--on-dark', 'light'), 'colourway-jungle');
  assert.equal(iconThemeForGround('colourway-jungle', 'light'), 'colourway-jungle');
  assert.equal(iconThemeForGround('ember', 'dark'), 'ember', "a palette's own id has no second pairing");
  assert.equal(iconThemeForGround('', 'dark'), null, 'Original is no pairing on either ground');
  assert.equal(iconThemeForGround(null, 'light'), null);
});

test('an id chosen on the other ground finds the same colourway on this one', async () => {
  dom();
  const { iconThemeById } = await import('./shared.ts');
  const onDark = { iconThemes: DARK, iconThemeGround: 'dark' as const };
  assert.equal(iconThemeById(onDark, 'colourway-eu-policy')?.id, 'colourway-eu-policy--on-dark');
  assert.equal(iconThemeById(onDark, 'colourway-eu-policy--on-dark')?.c1, '#ffffff');
  const onLight = { iconThemes: LIGHT, iconThemeGround: 'light' as const };
  assert.equal(iconThemeById(onLight, 'colourway-jungle--on-dark')?.id, 'colourway-jungle');
  assert.equal(iconThemeById(onLight, 'colourway-missing'), undefined);
  assert.equal(iconThemeById(onLight, null), undefined);
});

test('flipping the ground moves every swatch and the chosen pair to the pairing for that ground', async () => {
  const env = dom();
  const doc = env.window.document;
  const { ASSET_GROUND_KEY } = await import('./shared.ts');
  const { syncIconPairs } = await import('./wiring.ts');
  const duo = (th: IconTheme, on: boolean): string =>
    `<button type="button" class="cat-dl-theme${on ? ' is-active' : ''}" data-theme="${th.id}" aria-pressed="${on}" title="${th.label}"><span class="cat-dl-duo"><i style="background:${th.c2}"></i><i style="background:${th.c1}"></i></span></button>`;
  doc.body.innerHTML = `<div id="view"><div class="catalog"><div class="cat-group" data-icon-theme="colourway-eu-policy">
    <div class="cat-dl-themes"><button type="button" class="cat-dl-theme" data-theme="" aria-pressed="false" title="Original">Original</button>${duo(LIGHT[0]!, false)}${duo(LIGHT[1]!, true)}</div>
    <div class="cat-dl-themes"><button type="button" class="cat-dl-theme cat-dl-treat" data-treatment="colourway-jungle">wash</button></div>
    <div class="cat-tile" data-id="suse/icons/ai"><img class="cat-thumb" src="/icon.svg"></div>
  </div></div></div>`;
  const viewEl = doc.getElementById('view')!;
  const ref = { id: 'suse/icons/ai', source: 'library', type: 'vector', format: 'svg', url: '/icon.svg', meta: { tags: ['themable'] } } as unknown as AssetRef;
  const asked: Array<string | undefined> = [];
  const cat = {
    viewEl, detailsDialog: null, mounted: true,
    iconThemes: LIGHT, iconThemeGround: 'light' as 'light' | 'dark', catIconTheme: 'colourway-eu-policy' as string | null,
    assetById: new Map([[ref.id, ref]]), iconSvgCache: new Map([[ref.id, ICON]]),
    host: { assets: { _iconThemes: async (_id?: string, ground?: 'light' | 'dark') => { asked.push(ground); return ground === 'dark' ? DARK : LIGHT; } } },
  };
  const run = (): Promise<void> => syncIconPairs(cat as never);
  const ids = (): string[] => [...viewEl.querySelectorAll<HTMLElement>('.cat-dl-theme:not(.cat-dl-treat)')].map(b => b.dataset.theme ?? '');
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20));

  await run();
  assert.deepEqual(asked, [], 'the ground has not changed: nothing is read');

  env.window.localStorage.setItem(ASSET_GROUND_KEY, 'dark');
  await run();
  await settle();
  assert.deepEqual(asked, ['dark']);
  assert.deepEqual(ids(), ['', 'colourway-jungle--on-dark', 'colourway-eu-policy--on-dark'], 'Original keeps its empty id');
  assert.equal(cat.catIconTheme, 'colourway-eu-policy--on-dark');
  assert.equal(cat.iconThemeGround, 'dark');
  const eu = viewEl.querySelector<HTMLElement>('[data-theme="colourway-eu-policy--on-dark"]')!;
  assert.equal(eu.getAttribute('aria-pressed'), 'true', 'the chosen colourway stays chosen');
  assert.deepEqual([...eu.querySelectorAll<HTMLElement>('i')].map(i => i.style.background), ['rgb(144, 235, 205)', 'rgb(255, 255, 255)'], 'base then accent');
  assert.equal(viewEl.querySelector<HTMLElement>('.cat-dl-treat')!.dataset.treatment, 'colourway-jungle', 'a photo wash is not an icon pairing');
  const group = viewEl.querySelector<HTMLElement>('.cat-group')!;
  assert.equal(group.dataset.iconTheme, 'colourway-eu-policy--on-dark');
  const drawn = decodeURIComponent(viewEl.querySelector<HTMLImageElement>('.cat-thumb')!.src);
  assert.match(drawn, /\.c1\{fill:#ffffff\}\.c2\{fill:#90ebcd\}/i, 'the tile is drawn in the pairing for a dark ground');

  env.window.localStorage.removeItem(ASSET_GROUND_KEY);
  await run();
  await settle();
  assert.deepEqual(ids(), ['', 'colourway-jungle', 'colourway-eu-policy']);
  assert.equal(cat.catIconTheme, 'colourway-eu-policy');
  assert.match(decodeURIComponent(viewEl.querySelector<HTMLImageElement>('.cat-thumb')!.src), /\.c1\{fill:#90ebcd\}\.c2\{fill:#192072\}/i);
});

test('with Original chosen the swatches move and no tile is redrawn', async () => {
  const env = dom();
  const doc = env.window.document;
  const { ASSET_GROUND_KEY } = await import('./shared.ts');
  const { syncIconPairs } = await import('./wiring.ts');
  doc.body.innerHTML = `<div id="view"><div class="cat-group"><div class="cat-dl-themes">
    <button type="button" class="cat-dl-theme is-active" data-theme="" aria-pressed="true">Original</button>
    <button type="button" class="cat-dl-theme" data-theme="colourway-jungle"><span class="cat-dl-duo"><i></i><i></i></span></button></div>
    <div class="cat-tile" data-id="suse/icons/ai"><img class="cat-thumb" src="/icon.svg"></div></div></div>`;
  const viewEl = doc.getElementById('view')!;
  const cat = {
    viewEl, detailsDialog: null, mounted: true, iconThemes: LIGHT, iconThemeGround: 'light' as 'light' | 'dark', catIconTheme: null as string | null,
    assetById: new Map(), iconSvgCache: new Map(),
    host: { assets: { _iconThemes: async (_id?: string, ground?: 'light' | 'dark') => (ground === 'dark' ? DARK : LIGHT) } },
  };
  env.window.localStorage.setItem(ASSET_GROUND_KEY, 'dark');
  await syncIconPairs(cat as never);
  assert.equal(viewEl.querySelector<HTMLElement>('.cat-dl-theme:not([data-theme=""])')!.dataset.theme, 'colourway-jungle--on-dark');
  assert.equal(cat.catIconTheme, null);
  assert.equal(viewEl.querySelector<HTMLImageElement>('.cat-thumb')!.getAttribute('src'), '/icon.svg');
  env.window.localStorage.removeItem(ASSET_GROUND_KEY);
});
