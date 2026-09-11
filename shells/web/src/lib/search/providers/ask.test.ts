// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask spotlight provider (plans/103 M0). Pins the single-hit contract: one
 * row that carries the query into #/ask?q=, encoded; nothing for an empty query.
 *
 * Run directly:  node --test shells/web/src/lib/search/providers/ask.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createAskProvider } = await import('./ask.ts');
const { tokenize } = await import('../match.ts');

test('empty query yields no hit', async () => {
  assert.deepEqual(await createAskProvider().search([], 5), []);
});

test('emits exactly one hit that carries the joined tokens into #/ask?q=', async () => {
  const hits = await createAskProvider().search(tokenize('how do I export'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, `#/ask?q=${encodeURIComponent('how do i export')}`);
  assert.equal(hits[0]!.score, 1);
  assert.ok(hits[0]!.title.includes('how do i export'));
  assert.ok(hits[0]!.icon.includes('<svg'));
});

test('special characters in the query are URL-encoded in the href', async () => {
  const hits = await createAskProvider().search(tokenize('a & b'), 5);
  assert.equal(hits[0]!.href, `#/ask?q=${encodeURIComponent('a & b')}`);
  assert.ok(!hits[0]!.href.includes('&b'), 'a raw & would corrupt the query string');
});
