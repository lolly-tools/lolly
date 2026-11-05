// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { InputValue } from '../engine/src/inputs.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { createCalcAPI, createCalcEngine } from '../engine/src/calc.ts';
import { compileGridcraftCalc, createGridcraftCalcRunner } from '../packages/node-shell/src/gridcraft-calc.ts';
import { baseHost } from './helpers/host.ts';

const root = new URL('../community/', import.meta.url);
const quoteTool = await loadTool('quote', p => readFile(new URL(p, root), 'utf8'));

const calcRunner = createGridcraftCalcRunner(await compileGridcraftCalc(new Uint8Array(await readFile(new URL('../packages/node-shell/wasm/gridcraft-calc/gridcraft-calc.wasm', import.meta.url)))));
/** A host.calc over the real module at a fixed clock, counting its table calls. */
function calcHost(clock = { now: Date.UTC(2026, 10, 3, 12), seed: 5 }) {
  const api = createCalcAPI(createCalcEngine(calcRunner, () => clock));
  const seen = { tables: 0 };
  return { seen, host: baseHost({ calc: { ...api, table: (...args: Parameters<typeof api.table>) => { seen.tables++; return api.table(...args); } } }) };
}

async function quote(values: Record<string, InputValue>, host = baseHost()) {
  const runtime = await createRuntime(quoteTool, host, values);
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

test('Quote works out cells that start with = when the shell has host.calc', async () => {
  const { host } = calcHost();
  // The heading row is row 1: line one is row 2.
  const q = await quote({
    lines: table(['Seats', '=2*5', '=1200*0.9'], ['Days', '=B2', '=C2*2'], ['Later', '3', '']),
    currency: 'EUR', tax: 0, discount: 0,
  }, host);
  assert.equal(q.read('{{subtotalText}}'), '€32,400', '10 x 1,080 plus 10 x 2,160');
  assert.match(q.html, /Priced later/);
  assert.match(q.html, /€1,080/);
});

test('Quote marks a formula that fails and holds the totals back', async () => {
  const { host } = calcHost();
  const q = await quote({ lines: table(['Seats', '=1/0', '100'], ['Days', '2', '50']), currency: 'EUR' }, host);
  assert.match(q.html, /Check formula/);
  assert.equal(q.read('{{dueText}}'), '…');
  const malformed = await quote({ lines: table(['Seats', '=SUM(1,', '100']), currency: 'EUR' }, host);
  assert.match(malformed.html, /Check formula/);
});

test('Quote without host.calc reads a formula as a missing number and still renders', async () => {
  const q = await quote({ lines: table(['Seats', '=2*5', '100'], ['Days', '2', '50']), currency: 'EUR' });
  assert.match(q.html, /qt-line is-pending/);
  assert.equal(q.read('{{subtotalText}}'), '…');
});

test('Quote freezes volatile formulas: one evaluation per edit, and the page is what an export draws', async () => {
  const { host, seen } = calcHost();
  const runtime = await createRuntime(quoteTool, host, { lines: table(['Dice', '=RANDBETWEEN(1,1000000)', '10']), currency: 'EUR' });
  assert.equal(seen.tables, 1, 'the hooks evaluated once to mount');
  const first = runtime.getHydrated();
  const again = runtime.getHydrated();
  assert.equal(first, again, 'drawing the page again never re-reads the clock or the random source');
  assert.equal(seen.tables, 1, 'drawing the page evaluated nothing');
  runtime.destroy();
  // The same clock and seed give the same page; another seed gives another number.
  const same = calcHost();
  const a = await quote({ lines: table(['Dice', '=RANDBETWEEN(1,1000000)', '10']), currency: 'EUR' }, same.host);
  const b = await quote({ lines: table(['Dice', '=RANDBETWEEN(1,1000000)', '10']), currency: 'EUR' }, calcHost().host);
  const c = await quote({ lines: table(['Dice', '=RANDBETWEEN(1,1000000)', '10']), currency: 'EUR' }, calcHost({ now: 1, seed: 6 }).host);
  assert.equal(a.read('{{subtotalText}}'), b.read('{{subtotalText}}'));
  assert.notEqual(a.read('{{subtotalText}}'), c.read('{{subtotalText}}'));
});
