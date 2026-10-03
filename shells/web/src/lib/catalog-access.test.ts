// SPDX-License-Identifier: MPL-2.0
/**
 * lib/catalog-access.ts: a refusal belongs to one instance base.
 *
 *   node --test shells/web/src/lib/catalog-access.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { _setBaseForTests } = await import('./instance.ts');
const access = await import('./catalog-access.ts');

test('only 401 and 403 count as refused', () => {
  assert.deepEqual([200, 304, 401, 403, 404, 429, 500, 503].filter(access.isAccessRefused), [401, 403]);
});

test('a refusal is per instance base, remembered, and forgotten by a successful read', () => {
  localStorage.clear();
  access.resetCatalogAccessForTests();
  _setBaseForTests('https://team.example');
  assert.equal(access.catalogRefused(), false);
  assert.equal(access.catalogRefusedBefore(), false);
  access.noteCatalogRefused();
  assert.equal(access.catalogRefused(), true);
  assert.equal(localStorage.getItem('lolly:catalog-refused:https://team.example'), '1');

  // Switching instance starts clean: another base is not held back.
  _setBaseForTests('');
  assert.equal(access.catalogRefused(), false);
  assert.equal(access.catalogRefusedBefore(), false);

  // A new page load on the refused base still knows of the refusal, and a good read clears the record.
  _setBaseForTests('https://team.example');
  access.resetCatalogAccessForTests();
  assert.equal(access.catalogRefused(), false, 'page state is per load');
  assert.equal(access.catalogRefusedBefore(), true, 'the refusal is remembered');
  access.noteCatalogAllowed();
  assert.equal(access.catalogRefusedBefore(), false);
  _setBaseForTests('');
});

test('a successful read with nothing on record writes nothing', () => {
  localStorage.clear();
  access.resetCatalogAccessForTests();
  access.noteCatalogAllowed();
  assert.equal(localStorage.length, 0);
});
