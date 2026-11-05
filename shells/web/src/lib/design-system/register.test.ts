// SPDX-License-Identifier: MPL-2.0
/**
 * register.ts - the one start and end every wait at the register goes through.
 * Run directly:  node --test shells/web/src/lib/design-system/register.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><div id="c"></div>');
const { document } = window;
// components/lolly-spin.ts reads the DOM globals.
Object.assign(globalThis, { document, HTMLElement: window.HTMLElement, Element: window.Element });
const { beginRegister, withRegister, SPIN_DELAY_MS } = await import('./register.ts');
const box = document.getElementById('c') as unknown as HTMLElement;
const state = () => [box.getAttribute('aria-busy'), box.dataset.register ?? null];
const spins = () => [...box.children].filter(el => el.classList.contains('lolly-spin')) as HTMLElement[];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

test('a wait shows Lolly\'s spin after a short delay and takes it away when the last wait ends', async () => {
  const outer = beginRegister(box);
  const inner = beginRegister(box);
  assert.equal(spins().length, 1, 'one spin per container, however many waits');
  assert.equal(spins()[0]!.hidden, true, 'a quick answer never flashes the spin');
  await wait(SPIN_DELAY_MS + 20);
  assert.equal(spins()[0]!.hidden, false);
  inner();
  assert.equal(spins().length, 1, 'the outer wait keeps its spin');
  outer();
  assert.equal(spins().length, 0);
});

test('under Reduce motion the spin is still', () => {
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    const end = beginRegister(box);
    assert.ok(spins()[0]!.classList.contains('is-still'));
    end();
    assert.equal(spins().length, 0);
  } finally {
    delete document.documentElement.dataset.a11yMotion;
  }
});
