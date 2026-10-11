// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountBodyPopover } from './body-popover.ts';
import { wireMenuNavigation } from './menu-navigation.ts';

function harness(html: string) {
  const dom = new JSDOM(`<body>${html}</body>`, {
    pretendToBeVisual: true,
    url: 'https://lolly.tools/',
  });
  const { document } = dom.window;
  const panel = document.body.firstElementChild as HTMLElement;
  const get = (id: string) => document.getElementById(id)!;
  const press = (key: string, target: HTMLElement = document.activeElement as HTMLElement) => {
    const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  return { dom, document, panel, get, press };
}

test('menu arrows wrap and Home/End reach the endpoints without invoking actions', () => {
  const h = harness(
    '<div role="menu"><button id="a" role="menuitem">A</button><a id="b" role="menuitem" href="#b">B</a><button id="c" role="menuitem">C</button></div>'
  );
  const release = wireMenuNavigation(h.panel);
  let actions = 0;
  h.panel.addEventListener('click', () => {
    actions++;
  });
  h.get('a').focus();
  assert.equal(h.press('ArrowUp').defaultPrevented, true);
  assert.equal(h.document.activeElement, h.get('c'));
  h.press('ArrowDown');
  assert.equal(h.document.activeElement, h.get('a'));
  h.press('End');
  assert.equal(h.document.activeElement, h.get('c'));
  h.press('Home');
  assert.equal(h.document.activeElement, h.get('a'));
  assert.equal(actions, 0);
  assert.equal(h.press('Enter').defaultPrevented, false);
  assert.equal(h.press(' ').defaultPrevented, false);
  assert.equal(h.press('Tab').defaultPrevented, false);
  release();
});

test('hidden and native disabled items are omitted but unavailable explanations remain reachable', () => {
  const h = harness(
    '<div role="menu"><button id="a" role="menuitem">A</button><button role="menuitem" hidden>Hidden</button><div style="display:none"><button role="menuitem">Hidden parent</button></div><button role="menuitem" disabled>Disabled</button><button id="why" role="menuitem" aria-disabled="true" aria-describedby="reason">Unavailable</button><small id="reason">Needs permission</small><button id="c" role="menuitem">C</button></div>'
  );
  const release = wireMenuNavigation(h.panel);
  h.get('a').focus();
  h.press('ArrowDown');
  assert.equal(h.document.activeElement, h.get('why'));
  h.press('ArrowDown');
  assert.equal(h.document.activeElement, h.get('c'));
  assert.equal(h.get('why').getAttribute('aria-describedby'), 'reason');
  assert.equal(h.get('a').tabIndex, 0, 'ordinary menu Tab order stays intact');
  release();
});

test('roving menus scroll focused options into view and follow rebuilt option lists', () => {
  const h = harness(
    '<div role="group"><div id="list" role="menu"><button id="a" role="menuitemradio" tabindex="0">A</button><button id="b" role="menuitemradio" tabindex="-1">B</button></div></div>'
  );
  const release = wireMenuNavigation(h.panel, { roving: true });
  let scroll: ScrollIntoViewOptions | boolean | undefined;
  h.get('b').scrollIntoView = (options) => {
    scroll = options;
  };
  h.get('a').focus();
  h.press('ArrowDown');
  assert.equal(h.get('a').tabIndex, -1);
  assert.equal(h.get('b').tabIndex, 0);
  assert.deepEqual(scroll, { block: 'nearest', inline: 'nearest' });
  h.get('list').innerHTML =
    '<button id="c" role="menuitemradio" tabindex="0">C</button><button id="d" role="menuitemradio" tabindex="-1">D</button>';
  h.get('c').focus();
  h.press('End');
  assert.equal(h.document.activeElement, h.get('d'));
  assert.equal(h.get('c').tabIndex, -1);
  release();
});

test('editors and tabs retain their own directional keyboard behavior', () => {
  const h = harness(
    '<div role="group"><div role="tablist"><button id="tab" role="tab">Sort</button></div><div role="menu"><input id="input" type="number"><div id="text" contenteditable="true">Edit</div><button id="item" role="menuitem">Item</button></div></div>'
  );
  const release = wireMenuNavigation(h.panel);
  for (const id of ['tab', 'input', 'text']) {
    h.get(id).focus();
    assert.equal(h.press('ArrowDown').defaultPrevented, false, id);
    assert.equal(h.document.activeElement, h.get(id));
  }
  release();
});

test('navigation keys stay inside a menu while all its actions are unavailable', () => {
  const h = harness(
    '<div role="menu" tabindex="-1"><button role="menuitem" disabled>Switching</button></div>'
  );
  const release = wireMenuNavigation(h.panel);
  let escaped = 0;
  h.document.addEventListener('keydown', () => {
    escaped++;
  });
  h.panel.focus();
  assert.equal(h.press('ArrowDown').defaultPrevented, true);
  assert.equal(h.document.activeElement, h.panel);
  assert.equal(escaped, 0);
  release();
});

test('nested menus navigate only their current level and release removes navigation', () => {
  const h = harness(
    '<div role="menu"><button id="a" role="menuitem">A</button><div role="menu"><button id="b" role="menuitem">B</button><button id="c" role="menuitem">C</button></div><button id="d" role="menuitem">D</button></div>'
  );
  const release = wireMenuNavigation(h.panel);
  h.get('a').focus();
  h.press('ArrowDown');
  assert.equal(h.document.activeElement, h.get('d'));
  h.get('b').focus();
  h.press('End');
  assert.equal(h.document.activeElement, h.get('c'));
  release();
  assert.equal(h.press('Home').defaultPrevented, false);
  assert.equal(h.document.activeElement, h.get('c'));
});

test('a quiet touch sheet can enter its menu without navigating non-menu controls', () => {
  const h = harness(
    '<div role="dialog" tabindex="-1"><div role="menu"><button id="a" role="menuitem">A</button><button id="b" role="menuitem">B</button></div><button id="cancel">Cancel</button></div>'
  );
  const release = wireMenuNavigation(h.panel);
  h.panel.focus();
  h.press('ArrowDown');
  assert.equal(h.document.activeElement, h.get('a'));
  h.get('cancel').focus();
  assert.equal(h.press('ArrowUp').defaultPrevented, false);
  release();
});

test('popover navigation is opt-in, released on close and restored on reopen', () => {
  const h = harness('<button id="trigger">Open</button>');
  Object.assign(globalThis, {
    window: h.dom.window,
    document: h.document,
    HTMLElement: h.dom.window.HTMLElement,
    Node: h.dom.window.Node,
  });
  const open = (menuNavigation: boolean) =>
    mountBodyPopover(
      h.get('trigger'),
      (panel) => {
        panel.innerHTML =
          '<button id="a" role="menuitem">A</button><button id="b" role="menuitem">B</button>';
        return panel.querySelector<HTMLElement>('#a');
      },
      { className: 'test-menu', menuNavigation }
    );
  const ordinary = open(false);
  ordinary.open();
  assert.equal(h.press('End').defaultPrevented, false);
  assert.equal(h.document.activeElement, h.get('a'));
  ordinary.close();
  const menu = open(true);
  menu.open();
  const detached = h.get('a');
  h.press('End');
  assert.equal(h.document.activeElement, h.get('b'));
  h.press('Escape');
  assert.equal(menu.isOpen(), false);
  assert.equal(h.document.activeElement, h.get('trigger'));
  assert.equal(h.press('ArrowDown', detached).defaultPrevented, false);
  menu.open();
  h.press('End');
  assert.equal(h.document.activeElement, h.get('b'));
  menu.close();
});
