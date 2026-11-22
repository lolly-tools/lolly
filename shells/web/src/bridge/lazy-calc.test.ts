// SPDX-License-Identifier: MPL-2.0
/**
 * `host.calc` loads its module on the first formula, not inside createBridge.
 *
 * createBridge used to await the formula chunk's import, which put one round trip
 * (181 to 201 ms on the plan 371 phone profile) in front of every boot. The facade
 * keeps the same API for callers: every CalcAPI method, async, one load shared by
 * concurrent calls, and a failed load asked again on the next call.
 *
 * Run directly:  node --test shells/web/src/bridge/lazy-calc.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CalcAPI } from '@lolly-tools/core/host-v1';
import { lazyCalcAPI } from './index.ts';
import { createWebCalcAPI } from './gridcraft-calc.ts';

function fakeCalc(): CalcAPI {
  return {
    evaluate: async () => ({ sheets: [] }) as unknown as Awaited<ReturnType<CalcAPI['evaluate']>>,
    table: async table => ({ rows: table }) as unknown as Awaited<ReturnType<CalcAPI['table']>>,
    functions: async () => [{ name: 'SUM' }] as unknown as Awaited<ReturnType<CalcAPI['functions']>>,
  };
}

test('creating the facade loads nothing', () => {
  let loads = 0;
  lazyCalcAPI(async () => { loads++; return fakeCalc(); });
  assert.equal(loads, 0);
});

test('the facade offers every method the web calc API has', () => {
  const facade = lazyCalcAPI(async () => fakeCalc());
  assert.deepEqual(Object.keys(facade).sort(), Object.keys(createWebCalcAPI()).sort());
});

test('the first calls share one load and reach the module', async () => {
  let loads = 0;
  const facade = lazyCalcAPI(async () => { loads++; return fakeCalc(); });
  const [functions, table] = await Promise.all([
    facade.functions(),
    facade.table([['a'], ['=1+1']] as unknown as Parameters<CalcAPI['table']>[0]),
  ]);
  assert.equal(loads, 1);
  assert.deepEqual(functions, [{ name: 'SUM' }]);
  assert.deepEqual(table, { rows: [['a'], ['=1+1']] });
  await facade.evaluate({} as Parameters<CalcAPI['evaluate']>[0]);
  assert.equal(loads, 1, 'later calls reuse the module');
});

test('a failed load rejects that call and is asked again on the next', async () => {
  let loads = 0;
  const facade = lazyCalcAPI(async () => {
    loads++;
    if (loads === 1) throw new Error('chunk failed');
    return fakeCalc();
  });
  await assert.rejects(facade.functions(), /chunk failed/);
  assert.deepEqual(await facade.functions(), [{ name: 'SUM' }]);
  assert.equal(loads, 2);
});

test('createBridge does not wait for the formula chunk', () => {
  const bridge = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const body = bridge.slice(bridge.indexOf('export async function createBridge('));
  assert.match(body, /host\.calc = lazyCalcAPI\(async \(\) => \(await import\('\.\/gridcraft-calc\.ts'\)\)\.createWebCalcAPI\(\)\);/);
  assert.doesNotMatch(body, /host\.calc = \(await import/, 'an awaited import here holds every boot behind the chunk');
});
