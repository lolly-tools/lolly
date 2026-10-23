// SPDX-License-Identifier: MPL-2.0
/**
 * The painted canvas by id (stage.ts `canvasIndex`, review item A3). `liveBoxEl` used to
 * run two attribute-selector scans of the whole canvas per call, and an artboard always
 * missed the first. These pin the index's promises: one read of the canvas per paint, the
 * same element `querySelector` would return, a fallback when an element was swapped
 * without a paint signal, and no repeated scan for an id with no element.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { boxEl, canvasIndex, dropCanvasIndex, liveBoxEl } from './stage.ts';
import type { FcCtx } from './context.ts';

const dom = new JSDOM('<!doctype html><body></body>');
const doc = dom.window.document;

function fixture(html: string) {
  const canvasEl = doc.createElement('div');
  canvasEl.innerHTML = html;
  doc.body.replaceChildren(canvasEl);
  const scans: string[] = [];
  const qs = canvasEl.querySelector.bind(canvasEl);
  const qsa = canvasEl.querySelectorAll.bind(canvasEl);
  canvasEl.querySelector = ((s: string) => { scans.push(s); return qs(s); }) as typeof canvasEl.querySelector;
  canvasEl.querySelectorAll = ((s: string) => { scans.push(s); return qsa(s); }) as typeof canvasEl.querySelectorAll;
  const fc = {
    canvasEl,
    canvasIndex: null,
    keys: { cssEscape: (v: string) => v.replace(/["\\]/g, '\\$&') },
  } as unknown as FcCtx;
  return { fc, canvasEl, scans };
}

const PAINTED = `
  <div class="lolly-frame-page" data-frame-id="f1">
    <div class="lolly-box" data-box-id="a">A</div>
    <div class="lolly-box" data-box-id="b">B</div>
  </div>
  <div class="lolly-frame-page" data-frame-id="f2"><div class="lolly-box" data-box-id="a">again</div></div>
  <div class="lolly-box" data-box-id="loose">L</div>`;

test('one read of the canvas answers every lookup until the next paint', () => {
  const { fc, canvasEl, scans } = fixture(PAINTED);
  for (let i = 0; i < 5; i++) {
    for (const id of ['a', 'b', 'loose', 'f1', 'f2']) {
      const want = canvasEl.ownerDocument.querySelector(`.lolly-box[data-box-id="${id}"]`)
        ?? canvasEl.ownerDocument.querySelector(`.lolly-frame-page[data-frame-id="${id}"]`);
      assert.equal(liveBoxEl(fc, id), want, `${id}: the element the selectors find`);
    }
  }
  assert.equal(scans.length, 1, 'one querySelectorAll, however many lookups');
  assert.equal(boxEl(fc, 'f1'), null, 'an artboard has no .lolly-box ...');
  assert.equal(scans.length, 1, '... and saying so scans nothing');
  const ix = canvasIndex(fc);
  assert.equal(ix.list.length, 4, 'every card, in document order, for the stamps');
  assert.equal(ix.repeats.get('a')?.length, 1, 'a repeated id keeps its later cards too');
  dropCanvasIndex(fc);
  liveBoxEl(fc, 'a');
  assert.equal(scans.length, 2, 'a paint drops the index and the next lookup reads afresh');
});

test('a swapped element is found by the selectors, and a missing id is scanned once', () => {
  const { fc, canvasEl, scans } = fixture(PAINTED);
  const old = liveBoxEl(fc, 'b')!;
  const swapped = old.cloneNode(true) as HTMLElement;
  old.replaceWith(swapped);
  assert.equal(liveBoxEl(fc, 'b'), swapped, 'a disconnected hit falls back to the selectors');
  assert.equal(liveBoxEl(fc, 'b'), swapped);
  const before = scans.length;
  assert.equal(liveBoxEl(fc, 'group-row'), null, 'a row with no element (a group) has none');
  const once = scans.length;
  assert.equal(once - before, 2, 'it is looked for with both selectors, as before ...');
  assert.equal(liveBoxEl(fc, 'group-row'), null);
  assert.equal(scans.length, once, '... once per paint, not once per frame');
  // A paint that threw part way replaces the canvas with no paint signal.
  canvasEl.innerHTML = '<div class="lolly-box" data-box-id="group-row">now painted</div>';
  assert.equal(liveBoxEl(fc, 'group-row')?.textContent, 'now painted', 'a replaced canvas is noticed and read again');
});

test('an element that changed its id is not trusted', () => {
  const { fc } = fixture(PAINTED);
  const el = liveBoxEl(fc, 'loose')!;
  el.setAttribute('data-box-id', 'renamed');
  assert.equal(liveBoxEl(fc, 'loose'), null);
  assert.equal(liveBoxEl(fc, 'renamed'), el);
});

test('an empty canvas keeps no index, so the first paint is seen', () => {
  const { fc, canvasEl } = fixture('');
  assert.equal(liveBoxEl(fc, 'a'), null);
  assert.equal(fc.canvasIndex, null);
  canvasEl.innerHTML = '<div class="lolly-box" data-box-id="a">A</div>';
  assert.equal(liveBoxEl(fc, 'a')?.textContent, 'A');
});
