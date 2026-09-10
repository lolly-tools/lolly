// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { baseHost } from '../../../../tests/helpers/host.ts';
import { mountProjectsViewOptions } from './projects-view-options.ts';

function fixture(atRoot = false) {
  const dom = new JSDOM('<button id="trigger">View options</button><button id="outside">Outside</button>', { pretendToBeVisual: true, url: 'https://example.test' });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement, Element: w.Element, Node: w.Node, localStorage: w.localStorage });
  const anchor = w.document.querySelector<HTMLButtonElement>('#trigger')!;
  const changes: string[] = [];
  const popover = mountProjectsViewOptions(anchor, baseHost(), {
    atRoot, view: 'list', sort: 'modified',
    onView: value => changes.push('view:' + value),
    onSort: value => changes.push('sort:' + value),
  });
  const panel = () => w.document.querySelector<HTMLElement>('.projects-viewmenu');
  return { dom, w, anchor, changes, popover, panel, close: () => { popover.close(); w.close(); } };
}

test('view settings focus the current view and Escape restores the real trigger without changing choices', () => {
  const f = fixture();
  f.popover.open();
  assert.equal(f.panel()!.getAttribute('role'), 'dialog');
  assert.equal(f.anchor.getAttribute('aria-expanded'), 'true');
  assert.equal(f.w.document.activeElement, f.panel()!.querySelector('[data-vm="list"]'));
  f.w.document.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(f.panel(), null);
  assert.equal(f.w.document.activeElement, f.anchor);
  assert.equal(f.anchor.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(f.changes, []);
  f.close();
});

test('settings apply one choice, close, and omit the tool sort at the root', () => {
  const f = fixture(true);
  f.popover.open();
  assert.equal(f.panel()!.querySelector('[data-sort="tool"]'), null);
  f.panel()!.querySelector<HTMLButtonElement>('[data-sort="name"]')!.click();
  assert.deepEqual(f.changes, ['sort:name']);
  assert.equal(f.popover.isOpen(), false);
  f.popover.open();
  f.panel()!.querySelector<HTMLButtonElement>('[data-vm="preview"]')!.click();
  assert.deepEqual(f.changes, ['sort:name', 'view:preview']);
  f.close();
});

test('rapid close/reopen leaves one dismissible panel; outside click and route teardown remove it', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) { f.popover.open(); f.popover.close(); }
  f.popover.open();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.w.document.querySelectorAll('.projects-viewmenu').length, 1);
  f.w.document.querySelector('#outside')!.dispatchEvent(new f.w.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(f.popover.isOpen(), false);
  f.popover.open();
  f.w.dispatchEvent(new f.w.Event('hashchange'));
  assert.equal(f.panel(), null);
  assert.deepEqual(f.changes, []);
  f.close();
});

test('scroll follows the anchor without moving when the settings themselves scroll', () => {
  const f = fixture();
  let top = 100;
  f.anchor.getBoundingClientRect = () => ({ top, bottom: top + 30, left: 300, right: 330, width: 30, height: 30, x: 300, y: top, toJSON() {} });
  f.popover.open();
  assert.equal(f.panel()!.style.top, '138px');
  top = 50;
  f.w.dispatchEvent(new f.w.Event('scroll'));
  assert.equal(f.panel()!.style.top, '88px');
  top = 25;
  f.panel()!.dispatchEvent(new f.w.Event('scroll'));
  assert.equal(f.panel()!.style.top, '88px');
  f.close();
});
