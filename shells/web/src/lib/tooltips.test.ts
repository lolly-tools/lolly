// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTooltips } from './tooltips.ts';

function fixture() {
  const dom = new JSDOM('<body><div style="overflow:hidden"><button data-tip="Track height" aria-describedby="existing">Height</button></div></body>', { pretendToBeVisual: true });
  const doc = dom.window.document, button = doc.querySelector('button')!;
  const stop = mountTooltips(doc);
  const pointer = (type: string, extra: Record<string, unknown> = {}) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: 10, clientY: 10 }, extra);
    button.dispatchEvent(event); return event;
  };
  return { doc, button, pointer, close() { stop(); dom.window.close(); } };
}

test('focus help escapes a clipped parent and restores existing descriptions on dismissal', () => {
  const f = fixture();
  try {
    f.button.focus();
    const tip = f.doc.querySelector('[role="tooltip"]')!;
    assert.equal(tip.parentElement, f.doc.body);
    assert.equal(tip.textContent, 'Track height');
    assert.match(f.button.getAttribute('aria-describedby')!, /^existing lolly-tip-/);
    f.button.blur();
    assert.equal(f.doc.querySelector('[role="tooltip"]'), null);
    assert.equal(f.button.getAttribute('aria-describedby'), 'existing');
  } finally { f.close(); }
});

test('a completed touch hold explains before release and consumes its activation', async () => {
  const f = fixture(); let activations = 0;
  f.button.addEventListener('click', () => activations++);
  try {
    f.pointer('pointerdown');
    await new Promise(resolve => setTimeout(resolve, 540));
    assert.equal(f.doc.querySelector('[role="tooltip"]')?.textContent, 'Track height');
    let released = false; f.button.addEventListener('pointerup', () => { released = true; }, { once:true });
    assert.equal(f.pointer('pointerup').defaultPrevented, true);
    assert.equal(released, true, 'gesture trackers receive the release');
    f.button.click(); assert.equal(activations, 0);
    f.pointer('pointerdown'); f.pointer('pointerup'); f.button.click();
    assert.equal(activations, 1, 'an ordinary subsequent tap still acts');
  } finally { f.close(); }
});

test('scrolling, moving and cancelling a touch do not show help later', async () => {
  const f = fixture();
  try {
    for (const cancel of ['pointermove', 'pointercancel', 'scroll']) {
      f.pointer('pointerdown');
      f.pointer(cancel, { clientX: 30 });
      await new Promise(resolve => setTimeout(resolve, 520));
      assert.equal(f.doc.querySelector('[role="tooltip"]'), null, cancel);
    }
  } finally { f.close(); }
});
