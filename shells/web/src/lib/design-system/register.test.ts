// SPDX-License-Identifier: MPL-2.0
/**
 * register.ts - the one start and end every wait at the register goes through.
 * Run directly:  node --test shells/web/src/lib/design-system/register.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { beginRegister, withRegister } from './register.ts';

const { document } = new JSDOM('<!doctype html><div id="c"></div>').window;
const box = document.getElementById('c') as unknown as HTMLElement;
const state = () => [box.getAttribute('aria-busy'), box.dataset.register ?? null];

test('a wait marks its container busy and clears it when it ends, once', () => {
  const end = beginRegister(box);
  assert.deepEqual(state(), ['true', 'busy']);
  end();
  end();
  assert.deepEqual(state(), [null, null]);
});

test('an inner wait that ends first leaves the outer one busy', () => {
  const outer = beginRegister(box);
  const inner = beginRegister(box);
  inner();
  assert.deepEqual(state(), ['true', 'busy']);
  outer();
  assert.deepEqual(state(), [null, null]);
});

test('withRegister ends the wait however the work settles', async () => {
  assert.equal(await withRegister(box, async () => { assert.deepEqual(state(), ['true', 'busy']); return 3; }), 3);
  await assert.rejects(withRegister(box, async () => { throw new Error('no'); }), /no/);
  assert.deepEqual(state(), [null, null]);
});
