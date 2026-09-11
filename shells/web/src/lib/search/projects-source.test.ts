// SPDX-License-Identifier: MPL-2.0
/**
 * The shared projects search source (plans/99 M2) - haystack composition
 * (including the literal 'batch' keyword), folded token-AND semantics,
 * diacritic folding, the session-open href shapes, and the one-shot
 * Save-return marker. views/projects.ts and the spotlight's projects provider
 * both ride these helpers, so this file pins the contract they share.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/search/projects-source.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic import (the co-located suite convention).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;

const {
  buildSessionHaystack, buildFolderHaystack, matchesHaystack,
  sessionOpenHref, armSessionReturn, RETURN_KEY,
} = await import('./projects-source.ts');
const { tokenize } = await import('./match.ts');

const toolName = (id: string): string => (id === 'qr-code' ? 'QR Code' : id);
const entry = { slot: 'qr-code:1', toolId: 'qr-code', label: 'Café Menu', filename: 'menu-a4' };

test('haystack composes label, filename, tool name, tool id - folded', () => {
  const hay = buildSessionHaystack(entry, toolName, false);
  for (const q of ['cafe', 'menu-a4', 'qr code', 'qr-code']) {
    assert.ok(matchesHaystack(hay, tokenize(q)) > 0, `matches '${q}'`);
  }
  // Diacritic folding works from the query side too.
  assert.ok(matchesHaystack(hay, tokenize('Café')) > 0);
});

test('token-AND: every word must hit; any miss zeroes the whole match', () => {
  const hay = buildSessionHaystack(entry, toolName, false);
  assert.ok(matchesHaystack(hay, tokenize('cafe menu')) > 0);
  assert.equal(matchesHaystack(hay, tokenize('cafe zebra')), 0);
  // The old substring matcher would have required the words adjacent; token-AND
  // matches them independently, in any order.
  assert.ok(matchesHaystack(hay, tokenize('menu cafe')) > 0);
});

test("the literal 'batch' keyword rides batch sessions only", () => {
  assert.ok(matchesHaystack(buildSessionHaystack(entry, toolName, true), tokenize('batch')) > 0);
  assert.equal(matchesHaystack(buildSessionHaystack(entry, toolName, false), tokenize('batch')), 0);
});

test('null label/filename (the WebStateAPI row shape) are simply absent', () => {
  const hay = buildSessionHaystack({ slot: 's', toolId: 'qr-code', label: null, filename: null }, toolName, false);
  assert.ok(matchesHaystack(hay, tokenize('qr')) > 0);
  assert.equal(matchesHaystack(hay, tokenize('null')), 0);
});

test('folder haystack folds the name', () => {
  assert.ok(matchesHaystack(buildFolderHaystack('Événement'), tokenize('evenement')) > 0);
  assert.equal(matchesHaystack(buildFolderHaystack('Événement'), tokenize('picnic')), 0);
});

test('sessionOpenHref: single-tool resumes the tool with the slot; batch opens /pro', () => {
  assert.equal(sessionOpenHref(entry, false), '#/tool/qr-code?slot=qr-code%3A1');
  assert.equal(sessionOpenHref({ slot: '__batch__:Q3 run', toolId: '' }, true), '#/batch?session=__batch__%3AQ3%20run');
});

test('armSessionReturn writes the one-shot marker under the shared key', () => {
  armSessionReturn('/#/p/folder-1');
  assert.equal(sessionStorage.getItem(RETURN_KEY), '/#/p/folder-1');
  assert.equal(RETURN_KEY, 'lolly:returnTo'); // the literal views/tool.ts reads
  sessionStorage.removeItem(RETURN_KEY);
});
