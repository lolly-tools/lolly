// SPDX-License-Identifier: MPL-2.0
/**
 * Design's phone panel (views/design-phone-panel.ts): the tool view's drop-down sheet
 * holding the inspector and the layers list as two tabs. What jsdom can check: the live
 * elements move in and back out, the tabs and the grip say what they are and what state
 * they are in, only a person's choices are reported, and Escape folds the panel and hands
 * focus back. The stops, the drag and the canvas band are a real browser's
 * (tests/design-phone-panels.browser.test.ts).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/design-phone-panel.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  const value = (dom.window as unknown as Record<string, unknown>)[key];
  if (value) (globalThis as Record<string, unknown>)[key] = value;
}
Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 });
Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 844 });
const mql = (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(dom.window as unknown as { matchMedia: typeof mql }).matchMedia = mql;
(globalThis as Record<string, unknown>).matchMedia = mql;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 1; }) as typeof requestAnimationFrame;

const { mountDesignPhonePanel } = await import('./design-phone-panel.ts');

function fixture() {
  const layout = document.createElement('div');
  layout.className = 'tool-layout is-editor';
  const stage = document.createElement('div');
  const before = document.createElement('div');
  const nav = document.createElement('aside');
  nav.className = 'fc-nav';
  const after = document.createElement('div');
  stage.append(before, nav, after);
  layout.append(stage);
  const bar = document.createElement('button');
  bar.textContent = 'Inspect';
  document.body.append(layout, bar);
  const insp = document.createElement('aside');
  insp.className = 'fc-insp';
  insp.innerHTML = '<div class="fc-insp-headbar"><h2 class="fc-insp-coltitle">Document</h2></div><div class="fc-insp-scroll"><button>Size</button></div>';
  const changes: Array<{ tab: string; open: boolean }> = [];
  const panel = mountDesignPhonePanel({ layout, navigatorEl: nav, onChange: (c) => changes.push(c), onBand() {} });
  panel.host(insp);
  return { layout, stage, nav, before, after, insp, bar, panel, changes };
}

test('the panel takes the two live columns, names its tabs and its grip, and starts at its peek', async () => {
  const f = fixture();
  try {
    const body = f.panel.el.querySelector('.dpp-body')!;
    assert.deepEqual([...body.children], [f.insp, f.nav], 'the inspector first, then the layers list');
    assert.equal(f.layout.getAttribute('data-sheet'), 'peek', 'the tool view\'s own stop hook');
    assert.equal(f.panel.el.dataset.tab, 'inspect');
    const tabs = [...f.panel.el.querySelectorAll<HTMLElement>('[role="tab"]')];
    assert.deepEqual(tabs.map(b => b.textContent), ['Inspect', 'Layer/Page']);
    assert.deepEqual(tabs.map(b => b.getAttribute('aria-selected')), ['true', 'false']);
    assert.equal(f.panel.el.querySelector('[role="tablist"]')!.getAttribute('aria-label'), 'Editing panel');
    assert.equal(f.panel.grip.className, 'sheet-grip', 'the tool view\'s grip');
    assert.equal(f.panel.grip.getAttribute('aria-label'), 'Drag to resize controls, tap to expand');
    assert.equal(f.panel.grip.getAttribute('aria-controls'), f.panel.el.id);
    assert.equal(f.panel.grip.getAttribute('aria-expanded'), 'false');
    assert.equal(f.panel.el.querySelector('.dpp-name')!.textContent, 'Document', 'the head names the selection');
    // It follows the inspector's own head as the selection changes.
    f.insp.querySelector('.fc-insp-coltitle')!.textContent = 'Circle';
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(f.panel.el.querySelector('.dpp-name')!.textContent, 'Circle');
  } finally { f.panel.destroy(); f.layout.remove(); f.bar.remove(); }
});

test('the coordinator opens and folds it quietly; a person\'s tab and grip are reported', async () => {
  const f = fixture();
  try {
    f.bar.focus();
    f.panel.show('inspect', { focus: true });
    assert.equal(f.layout.getAttribute('data-sheet'), 'half');
    assert.equal(f.panel.isOpen(), true);
    assert.equal(f.panel.grip.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement?.textContent, 'Inspect', 'focus moved onto the panel\'s tab');
    assert.deepEqual(f.changes, [], 'what the coordinator asked for is not reported back to it');
    // The other tab is a person's choice.
    f.panel.el.querySelector<HTMLElement>('[data-tab="layers"]')!.click();
    assert.deepEqual(f.changes, [{ tab: 'layers', open: true }]);
    f.panel.show('layers');
    assert.equal(f.panel.el.dataset.tab, 'layers');
    // The grip's keyboard steps: on to full, back to half, then shut, which is reported.
    for (let i = 0; i < 3; i++) f.panel.grip.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    assert.equal(f.layout.getAttribute('data-sheet'), 'peek');
    assert.deepEqual(f.changes.at(-1), { tab: 'layers', open: false });
  } finally { f.panel.destroy(); f.layout.remove(); f.bar.remove(); }
});

test('Escape folds an open panel and hands focus back to what opened it, unless a menu is up', () => {
  const f = fixture();
  try {
    f.bar.focus();
    f.panel.show('inspect', { focus: true });
    const menu = document.createElement('div');
    menu.className = 'fc-popover';
    document.body.append(menu);
    f.panel.el.querySelector<HTMLElement>('[data-tab="inspect"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(f.panel.isOpen(), true, 'a menu over the panel is the inner surface and closes first');
    menu.remove();
    f.panel.el.querySelector<HTMLElement>('[data-tab="inspect"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(f.panel.isOpen(), false);
    assert.equal(document.activeElement, f.bar, 'focus is back on the bar\'s button');
    assert.deepEqual(f.changes, [{ tab: 'inspect', open: false }]);
  } finally { f.panel.destroy(); f.layout.remove(); f.bar.remove(); }
});

test('destroy puts the layers list back where it was and takes the sheet hooks off', () => {
  const f = fixture();
  f.panel.destroy();
  assert.deepEqual([...f.stage.children], [f.before, f.nav, f.after], 'back between its old neighbours');
  assert.equal(f.layout.hasAttribute('data-sheet'), false);
  assert.equal(f.layout.querySelector('.design-phone-panel, .sheet-grip, .dpp-probe'), null);
  f.layout.remove(); f.bar.remove();
});
