// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { wireViewPrewarmIntent } from './view-prewarm-intent.ts';

function fixture(completeAt = 3) {
  const dom = new JSDOM('<a href="#/tool/design">Design</a>');
  const { document, Element, MouseEvent, KeyboardEvent, FocusEvent } = dom.window;
  Object.assign(globalThis, { Element });
  const target = document.querySelector('a')!;
  const calls: Element[] = [];
  const stop = wireViewPrewarmIntent(document, node => { calls.push(node); }, () => calls.length >= completeAt);
  function pointer(type: string, x: number, y: number, pointerType = 'mouse', node: Element = target): void {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    node.dispatchEvent(event);
  }
  return { target, calls, stop, pointer, document, KeyboardEvent, FocusEvent };
}

test('stationary layout hover does not prewarm, while mouse and pen movement do', () => {
  const f = fixture();
  try {
    f.pointer('pointerover', 0, 0); f.pointer('pointermove', 0, 0);
    assert.equal(f.calls.length, 0);
    f.pointer('pointerover', 0, 0); f.pointer('pointermove', 0, 0);
    assert.equal(f.calls.length, 0);
    f.pointer('pointermove', 20, 10);
    f.pointer('pointermove', 30, 10, 'pen');
    assert.deepEqual(f.calls, [f.target], 'the same destination is not warmed twice when pointer type changes');
  } finally { f.stop(); }
});

test('movement across one element does no repeated lookup, while changed targets and explicit intent remain eligible', () => {
  const f = fixture(10);
  try {
    f.pointer('pointermove', 0, 0);
    for (let x = 1; x <= 500; x++) f.pointer('pointermove', x, 10);
    assert.deepEqual(f.calls, [f.target]);
    const next = f.document.createElement('a'); next.href = '#/p'; f.document.body.append(next);
    f.pointer('pointermove', 500, 10, 'pen', next);
    assert.equal(f.calls.length, 1, 'coordinates keep updating while the pointer stays on one element');
    f.pointer('pointermove', 501, 10, 'pen', next);
    f.pointer('pointermove', 502, 10);
    assert.deepEqual(f.calls, [f.target, next, f.target]);
    f.document.dispatchEvent(new f.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.target.dispatchEvent(new f.FocusEvent('focusin', { bubbles: true }));
    f.pointer('pointerdown', 502, 10, 'touch');
    assert.deepEqual(f.calls, [f.target, next, f.target, f.target, f.target]);
  } finally { f.stop(); }
});

test('touch activation and keyboard focus prewarm; programmatic focus does not', () => {
  const f = fixture();
  try {
    f.target.dispatchEvent(new f.FocusEvent('focusin', { bubbles: true }));
    f.pointer('pointermove', 20, 10, 'touch');
    assert.equal(f.calls.length, 0);
    f.pointer('pointerdown', 20, 10, 'touch');
    f.document.dispatchEvent(new f.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.target.dispatchEvent(new f.FocusEvent('focusin', { bubbles: true }));
    assert.deepEqual(f.calls, [f.target, f.target]);
  } finally { f.stop(); }
});

test('completed warming and explicit teardown remove every input listener', () => {
  const f = fixture();
  f.pointer('pointerdown', 1, 1); f.pointer('pointerdown', 1, 1); f.pointer('pointerdown', 1, 1);
  f.pointer('pointermove', 20, 10); f.pointer('pointerdown', 20, 10);
  f.document.dispatchEvent(new f.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  f.target.dispatchEvent(new f.FocusEvent('focusin', { bubbles: true }));
  assert.equal(f.calls.length, 3);
  const other = fixture(); other.stop(); other.pointer('pointerdown', 1, 1);
  assert.equal(other.calls.length, 0);
});
