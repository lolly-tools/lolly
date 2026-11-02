// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { InputValue } from '../engine/src/inputs.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { baseHost } from './helpers/host.ts';

const root = new URL('../community/', import.meta.url);
const quoteTool = await loadTool('quote', p => readFile(new URL(p, root), 'utf8'));

async function quote(values: Record<string, InputValue>) {
  const runtime = await createRuntime(quoteTool, baseHost(), values);
  const read = (expr: string): string => runtime.getHydratedString(expr);
  const html = runtime.getHydrated();
  runtime.destroy();
  return { read, html };
}

const table = (...rows: string[][]) => ({ columns: ['Item', 'Quantity', 'Unit price'], rows });

test('Quote totals each line and the quote, with discount and tax', async () => {
  const q = await quote({
    lines: table(['Subscription', '8', '2672'], ['Migration', '1', ''], ['Consulting days', '1', '4488'], ['Configuration hours', '40', '333']),
    tax: 21, discount: 0, currency: 'EUR', highlight: 1,
  });
  assert.equal(q.read('{{subtotalText}}'), '€39,184');
  assert.equal(q.read('{{taxText}}'), '€8,228.64');
  assert.equal(q.read('{{dueText}}'), '€47,412.64');
  assert.match(q.html, /Priced later/, 'a line with no price is priced later and stays out of the totals');
  assert.match(q.html, /qt-line is-picked/, 'the highlight input picks out its line');
  const discounted = await quote({ lines: table(['Seats', '10', '100']), discount: 10, tax: 0, currency: 'USD' });
  assert.equal(discounted.read('{{discountText}}'), '$100');
  assert.equal(discounted.read('{{dueText}}'), '$900');
});

test('Quote waits for a quantity still to be decided', async () => {
  const q = await quote({ lines: table(['Subscription', '?', '2672'], ['Consulting days', '1', '4488']), currency: 'EUR' });
  assert.equal(q.read('{{subtotalText}}'), '…');
  assert.equal(q.read('{{dueText}}'), '…');
  assert.match(q.html, /qt-line is-pending/);
});

test('Quote reads pasted amounts and finds its columns by heading', async () => {
  const q = await quote({
    lines: { columns: ['Unit price', 'Product', 'Qty'], rows: [['€ 2.672,50', 'Seats', '2'], ['1,200', 'Days', '1']] },
    currency: 'EUR',
  });
  assert.equal(q.read('{{dueText}}'), '€6,545', '2 x 2,672.50 plus 1 x 1,200');
  assert.equal(q.read('{{itemHead}}'), 'Product');
});

test('Quote lines travel in a URL and its hooks need no host', async () => {
  const state = parseUrlState(`t=${encodeURIComponent('Item,Quantity,Unit price~Seats,3,50')}&currency=GBP`, quoteTool.manifest);
  const q = await quote(state.values as Record<string, InputValue>);
  assert.equal(q.read('{{dueText}}'), '£150');
  assert.deepEqual(quoteTool.manifest.requires ?? [], []);
  assert.ok(analyseIsolation(await readFile(new URL('quote/hooks.js', root), 'utf8')).clean);
});
