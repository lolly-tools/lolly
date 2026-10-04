// SPDX-License-Identifier: MPL-2.0
/**
 * Card size (components/view-options.ts): the stored step per view, the default that
 * leaves every grid as it was, and the CSS each grid reads the step through.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement });
const VO = await import('./view-options.ts');

const css = (rel: string): string => readFileSync(new URL(`../styles/parts/${rel}`, import.meta.url), 'utf8');

test('each view keeps its own step, the default is stored as nothing, and junk reads as the default', () => {
  localStorage.clear();
  assert.equal(VO.readCardSize('tools'), VO.CARD_SIZE_DEFAULT);
  VO.writeCardSize('tools', 4);
  VO.writeCardSize('projects', 0);
  assert.equal(VO.readCardSize('tools'), 4);
  assert.equal(VO.readCardSize('projects'), 0);
  assert.equal(VO.readCardSize('catalog'), VO.CARD_SIZE_DEFAULT, 'one view does not move another');
  VO.writeCardSize('tools', VO.CARD_SIZE_DEFAULT);
  assert.equal(localStorage.getItem('lolly-card-size-tools'), null, 'back at the default nothing is stored');
  for (const junk of ['9', '-1', '1.5', 'big', '']) {
    localStorage.setItem('lolly-card-size-utilities', junk);
    assert.equal(VO.readCardSize('utilities'), VO.CARD_SIZE_DEFAULT, `"${junk}" reads as the default`);
  }
});

test('a neutral capture always draws the default size', () => {
  localStorage.clear();
  VO.writeCardSize('catalog', 0);
  localStorage.setItem('lolly-capture-neutral', '1');
  try { assert.equal(VO.readCardSize('catalog'), VO.CARD_SIZE_DEFAULT); }
  finally { localStorage.removeItem('lolly-capture-neutral'); }
  assert.equal(VO.readCardSize('catalog'), 0);
});

test('the default step leaves the grid with no attribute; every other step names itself', () => {
  assert.equal(VO.cardSizeAttr(VO.CARD_SIZE_DEFAULT), '');
  assert.equal(VO.cardSizeAttr(0), ' data-card-size="0"');
  const el = document.createElement('div');
  VO.applyCardSize(el, 3);
  assert.equal(el.getAttribute('data-card-size'), '3');
  VO.applyCardSize(el, VO.CARD_SIZE_DEFAULT);
  assert.equal(el.hasAttribute('data-card-size'), false);
});

test('the slider row is a labelled five-step range between the two grid glyphs, hidden on request', () => {
  const host = document.createElement('div');
  host.innerHTML = VO.cardSizeHtml(1, true);
  const row = host.querySelector<HTMLElement>('.view-options-size')!;
  assert.equal(row.hidden, true);
  const range = row.querySelector<HTMLInputElement>('input[type="range"].field-range')!;
  assert.deepEqual([range.min, range.max, range.step, range.value], ['0', '4', '1', '1']);
  assert.equal(range.getAttribute('aria-label'), 'Card size');
  assert.equal(row.querySelectorAll('svg[aria-hidden="true"]').length, 2, 'the glyphs are decoration; the range carries the name');
});

test('every non-default step has its CSS, and the grids only change when the attribute is present', () => {
  const gallery = css('gallery.css');
  for (const step of [0, 1, 3, 4]) {
    assert.match(gallery, new RegExp(`\\[data-card-size="${step}"\\] \\{ --card-shift: -?\\d+; --card-scale: [\\d.]+; \\}`), `step ${step} sets a shift and a scale`);
  }
  assert.doesNotMatch(gallery, /\[data-card-size="2"\]/, 'the default step has no rule of its own');
  assert.match(gallery, /\.tool-masonry \{\n {2}--cols: 4;[\s\S]*?grid-template-columns: repeat\(var\(--cols\), minmax\(0, 1fr\)\);/, 'the Tools ladder is untouched');
  assert.match(gallery, /\.tool-masonry:is\(\[data-card-size="0"\], \[data-card-size="1"\]\) \{ grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, var\(--tool-card-min\)\), 1fr\)\); \}/, 'the smaller Tools steps keep a legible card width');
  assert.match(gallery, /\.tool-masonry:is\(\[data-card-size="3"\], \[data-card-size="4"\]\) \{ grid-template-columns: repeat\(max\(1, var\(--cols\) \+ var\(--card-shift\)\), minmax\(0, 1fr\)\); \}/);
  assert.match(css('assets.css'), /\.catalog\[data-card-size\] \.cat-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, calc\(var\(--cat-card-min\) \* var\(--card-scale\)\)\), 1fr\)\); \}/);
  assert.match(css('projects.css'), /\.projects-grid\[data-card-size\]:not\(\.projects-list\) \{ grid-template-columns: repeat\(auto-fill, calc\(180px \* var\(--card-scale\)\)\); \}/);
});
