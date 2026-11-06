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

test('action feedback replaces hover help, preserves focus and dismisses when the anchor leaves', async () => {
  const { showTooltipToast } = await import('./tooltips.ts');
  const f = fixture();
  try {
    f.button.focus();
    const close = showTooltipToast(f.button, 'Link copied');
    assert.equal(f.doc.querySelector('[role="tooltip"]'), null);
    assert.equal(f.doc.querySelector('.lolly-tooltip-toast')?.textContent, 'Link copied');
    assert.equal(f.doc.activeElement, f.button);
    f.button.remove(); await Promise.resolve();
    assert.equal(f.doc.querySelector('.lolly-tooltip-toast'), null);
    close();
  } finally { f.close(); }
});

/** A tip on an element that holds a panel, as a colour field's wrapper holds its popover. */
function panelFixture() {
  const dom = new JSDOM('<body><span id="wrap" data-tip="Artboard fill"><button id="open">Open</button><div id="panel" data-tip-boundary><button id="pick">Pick</button><button id="inner" data-tip="On Main">Aa</button></div></span></body>', { pretendToBeVisual: true });
  const doc = dom.window.document;
  const stop = mountTooltips(doc);
  const over = (id: string): void => {
    const event = new dom.window.Event('pointerover', { bubbles: true });
    Object.assign(event, { pointerType: 'mouse' });
    doc.getElementById(id)!.dispatchEvent(event);
  };
  const tip = (): string | null => doc.querySelector('[role="tooltip"]')?.textContent ?? null;
  return { dom, doc, over, tip, panel: doc.getElementById('panel')!, close() { stop(); dom.window.close(); } };
}

test('a tip on an element says nothing about a panel inside the element, and a tip in the panel still works', () => {
  const f = panelFixture();
  try {
    f.over('open');
    assert.equal(f.tip(), 'Artboard fill', 'the control itself keeps its tip');
    f.over('pick');
    assert.equal(f.tip(), null, 'moving into the panel takes the tip down');
    f.doc.getElementById('pick')!.focus();
    assert.equal(f.tip(), null, 'and focus inside the panel shows none');
    f.over('inner');
    assert.equal(f.tip(), 'On Main');
  } finally { f.close(); }
});

test('Escape with a panel open inside the tip\'s element reaches the panel, and otherwise stops at the tip', () => {
  const f = panelFixture();
  const press = (): { reached: boolean; prevented: boolean } => {
    let reached = false;
    const seen = (): void => { reached = true; };
    f.doc.getElementById('open')!.addEventListener('keydown', seen, { once: true });
    const event = new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    f.doc.getElementById('open')!.dispatchEvent(event);
    return { reached, prevented: event.defaultPrevented };
  };
  try {
    f.over('open');
    assert.equal(f.tip(), 'Artboard fill');
    assert.deepEqual(press(), { reached: true, prevented: false }, 'one press closes the panel');
    assert.equal(f.tip(), null, 'and takes the tip down with it');

    f.panel.hidden = true;
    f.over('pick'); f.over('open');
    assert.equal(f.tip(), 'Artboard fill');
    assert.deepEqual(press(), { reached: false, prevented: true }, 'with the panel shut the press is the tip\'s alone');
    assert.equal(f.tip(), null);
  } finally { f.close(); }
});
