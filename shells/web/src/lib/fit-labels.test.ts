// SPDX-License-Identifier: MPL-2.0
/**
 * lib/fit-labels.ts - steps apply gentlest first and only as far as needed, the
 * `after` hook sees the count, and a window resize re-fits a connected element.
 * jsdom has no layout, so `overflows` is a stub driven by a pretend width budget.
 *
 * Run directly:  node --test shells/web/src/lib/fit-labels.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="row"></div></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { fitLabels } = await import('./fit-labels.ts');

const row = document.getElementById('row')!;
// Pretend widths: 900 labelled, 700 with .is-tight, 500 with .is-compact too.
let room = 1000;
const width = (): number => row.classList.contains('is-compact') ? 500 : row.classList.contains('is-tight') ? 700 : 900;
const overflows = (): boolean => width() > room;

test('nothing is collapsed when the labels fit', () => {
  room = 1000;
  assert.equal(fitLabels(row, ['is-tight', 'is-compact'], overflows), 0);
  assert.equal(row.className, '');
});

test('only the steps it takes are applied, in order', () => {
  room = 800;
  assert.equal(fitLabels(row, ['is-tight', 'is-compact'], overflows), 1);
  assert.deepEqual([...row.classList], ['is-tight']);
  room = 600;
  assert.equal(fitLabels(row, ['is-tight', 'is-compact'], overflows), 2);
  assert.deepEqual([...row.classList], ['is-tight', 'is-compact']);
});

test('steps come off again when there is room', () => {
  room = 1000;
  let seen = -1;
  fitLabels(row, ['is-tight', 'is-compact'], overflows, (n) => { seen = n; });
  assert.equal(row.className, '');
  assert.equal(seen, 0);
});

test('a window resize re-fits and calls after again', () => {
  let seen = -1;
  room = 1000;
  fitLabels(row, ['is-tight', 'is-compact'], overflows, (n) => { seen = n; });
  room = 600;
  window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(seen, 2);
  assert.ok(row.classList.contains('is-compact'));
});

test('a hidden element is left fully labelled', () => {
  room = 100;
  row.hidden = true;
  assert.equal(fitLabels(row, ['is-tight', 'is-compact'], overflows), 0);
  assert.equal(row.className, '');
  row.hidden = false;
});
