// SPDX-License-Identifier: MPL-2.0
/**
 * lib/tool-guides.ts (plan 354 D6): the tool to docs list, fetched once per locale from
 * the /info build, read quietly, and turned into in-app reader routes.
 *
 * Run directly:  node --test shells/web/src/lib/tool-guides.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const calls: string[] = [];
let respond: () => Promise<{ ok: boolean; json(): Promise<unknown> }> = async () => ({ ok: true, json: async () => ({}) });
globalThis.fetch = ((url: string) => { calls.push(String(url)); return respond(); }) as unknown as typeof fetch;

const { toolGuideRows, toolGuideHref, toolGuideLabel, _resetToolGuides } = await import('./tool-guides.ts');

const BODY = {
  version: 1,
  tools: {
    'qr-code': [
      { p: 'start/make-something', a: '', t: 'Make your first file', h: '' },
      { p: 'create/exporting', a: 'size-and-print-units', t: 'Export a file', h: 'Size and print units' },
      { p: '', a: '', t: '', h: '' },
      'not a row',
    ],
  },
};

test('reads one tool\'s rows once, and drops anything that is not a whole row', async () => {
  _resetToolGuides(); calls.length = 0;
  respond = async () => ({ ok: true, json: async () => BODY });
  const rows = await toolGuideRows('qr-code');
  assert.equal(rows.length, 2);
  assert.deepEqual(await toolGuideRows('trim'), [], 'a tool with no rows gets none');
  assert.deepEqual(await toolGuideRows('constructor'), [], 'an inherited key is not a tool');
  assert.deepEqual(calls, ['/info/tool-guides.json'], 'fetched once, from the English build');
});

test('offline, a missing file or a broken one means no rows, never an error', async () => {
  for (const r of [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }),
  ]) {
    _resetToolGuides();
    respond = r as typeof respond;
    assert.deepEqual(await toolGuideRows('qr-code'), []);
  }
});

test('a row opens the in-app reader at its section, and names the section then its page', () => {
  const [page, section] = BODY.tools['qr-code'] as Array<{ p: string; a: string; t: string; h: string }>;
  assert.equal(toolGuideHref(page!), '#/docs/start/make-something');
  assert.equal(toolGuideHref(section!), '#/docs/create/exporting?h=size-and-print-units');
  assert.deepEqual(toolGuideLabel(section!), { title: 'Size and print units', page: 'Export a file' });
  assert.deepEqual(toolGuideLabel(page!), { title: 'Make your first file', page: '' });
});
