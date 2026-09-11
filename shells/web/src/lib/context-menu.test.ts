// SPDX-License-Identifier: MPL-2.0
/**
 * lib/context-menu.ts - the shared tile context menu's contract: right-click
 * routing (single vs bulk vs declined-to-native), action dispatch after close,
 * and the press-and-hold touch bridge (timer fire, slop cancel, click swallow).
 *
 * jsdom hosts the real mountBodyPopover underneath, so what this pins is the
 * genuine open/close lifecycle, not a stub. Timers use node:test's mock clock - 
 * the module deliberately uses BARE setTimeout for exactly this reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { wireTileContextMenu, menuItemHtml } from './context-menu.ts';
import type { TileContextMenuHandle } from './context-menu.ts';

interface Harness {
  host: HTMLElement;
  doc: Document;
  menu: TileContextMenuHandle;
  actions: Array<{ act: string; ref: string | null }>;
  selected: Set<string>;
  tile(ref: string): HTMLElement;
  openMenuEl(): HTMLElement | null;
}

function harness(): Harness {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  (globalThis as Record<string, unknown>).Node = w.Node;

  const doc = w.document;
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  for (const ref of ['a', 'b', 'declined']) {
    const tile = doc.createElement('article');
    tile.className = 'tile';
    tile.dataset.ref = ref;
    host.appendChild(tile);
  }

  const actions: Array<{ act: string; ref: string | null }> = [];
  const selected = new Set<string>();
  const menu = wireTileContextMenu({
    host: host as unknown as HTMLElement,
    tileSelector: '.tile',
    refOf: (tile) => (tile.dataset.ref === 'declined' ? null : tile.dataset.ref ?? null),
    isBulkTarget: (ref) => selected.size > 1 && selected.has(ref),
    singleHtml: (tgt) => menuItemHtml('one', '', `Act on ${tgt.ref}`) + menuItemHtml('two', '', 'Second'),
    bulkHtml: () => `<p class="folder-menu-head">${selected.size} selected</p><div class="folder-menu-list" role="menu">${menuItemHtml('bulk-act', '', 'Bulk')}</div>`,
    onAction: (act, tgt) => { actions.push({ act, ref: tgt?.ref ?? null }); },
  });

  return {
    host: host as unknown as HTMLElement,
    doc: doc as unknown as Document,
    menu,
    actions,
    selected,
    tile: (ref) => host.querySelector(`[data-ref="${ref}"]`) as HTMLElement,
    openMenuEl: () => doc.querySelector('.folder-menu') as HTMLElement | null,
  };
}

function fire(el: HTMLElement, type: string, props: Record<string, unknown> = {}): Event {
  const doc = el.ownerDocument!;
  const e = new (doc.defaultView!.Event)(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: 10, clientY: 10, button: 0, ...props });
  el.dispatchEvent(e);
  return e;
}

test('right-click on a tile opens its menu; a declined tile keeps the native menu', () => {
  const h = harness();
  const e = fire(h.tile('a'), 'contextmenu');
  assert.ok(e.defaultPrevented, 'the native menu is suppressed');
  const menu = h.openMenuEl();
  assert.ok(menu, 'popover mounted');
  assert.equal(menu!.getAttribute('role'), 'menu');
  assert.match(menu!.textContent ?? '', /Act on a/);

  h.menu.close();
  const e2 = fire(h.tile('declined'), 'contextmenu');
  assert.ok(!e2.defaultPrevented, 'refOf → null falls through to the native menu');
  assert.equal(h.openMenuEl(), null);
  h.menu.destroy();
});

test('right-click inside a multi-selection opens the BULK menu (role demoted to group)', () => {
  const h = harness();
  h.selected.add('a').add('b');
  fire(h.tile('a'), 'contextmenu');
  const menu = h.openMenuEl()!;
  assert.equal(menu.getAttribute('role'), 'group', 'outer div demotes; the inner list carries role=menu');
  assert.match(menu.textContent ?? '', /2 selected/);

  // A one-item selection is never "bulk" - the tile gets its own single menu.
  h.menu.close();
  h.selected.clear();
  h.selected.add('b');
  fire(h.tile('b'), 'contextmenu');
  assert.equal(h.openMenuEl()!.getAttribute('role'), 'menu');
  h.menu.destroy();
});

test('clicking a row closes the menu first, then dispatches onAction', () => {
  const h = harness();
  fire(h.tile('a'), 'contextmenu');
  const row = h.openMenuEl()!.querySelector<HTMLElement>('[data-act="one"]')!;
  row.click();
  assert.equal(h.openMenuEl(), null, 'closed before the action ran');
  assert.deepEqual(h.actions, [{ act: 'one', ref: 'a' }]);
  h.menu.destroy();
});

test('press-and-hold (touch) opens the menu and swallows the trailing click', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const tile = h.tile('a');

  fire(tile, 'pointerdown', { pointerType: 'touch' });
  assert.equal(h.openMenuEl(), null, 'nothing before the hold elapses');
  t.mock.timers.tick(419);
  assert.equal(h.openMenuEl(), null);
  t.mock.timers.tick(1);
  assert.ok(h.openMenuEl(), 'menu opens at HOLD_MS');

  // The pointerup that ends the hold still delivers a click - it must not reach the tile.
  const click = fire(tile, 'click');
  assert.ok(click.defaultPrevented, 'trailing click swallowed');

  // Android also fires a late contextmenu after a long-press - absorbed, not a re-open flicker.
  // (holdFired was consumed by the click above, so this exercises the normal path instead.)
  h.menu.destroy();
  t.mock.timers.reset();
});

test('press-and-hold cancels on travel (a scroll, not a hold) and on mouse pointers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const tile = h.tile('a');

  // Travel past the slop cancels.
  fire(tile, 'pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 });
  fire(tile, 'pointermove', { pointerType: 'touch', clientX: 10, clientY: 40 });
  t.mock.timers.tick(1000);
  assert.equal(h.openMenuEl(), null, 'a travelled press never opens the menu');

  // A mouse press never arms the hold at all (mice have a real right-click).
  fire(tile, 'pointerdown', { pointerType: 'mouse' });
  t.mock.timers.tick(1000);
  assert.equal(h.openMenuEl(), null);

  h.menu.destroy();
  t.mock.timers.reset();
});

test('destroy() unbinds the host listeners', () => {
  const h = harness();
  h.menu.destroy();
  const e = fire(h.tile('a'), 'contextmenu');
  assert.ok(!e.defaultPrevented, 'no handler left after destroy');
  assert.equal(h.openMenuEl(), null);
});

// ── background menu (plans/133 WP-13: right-click on empty canvas) ──────────

const BG_HTML = menuItemHtml('new-folder', '', 'New folder');

interface BgHarness {
  host: HTMLElement;
  doc: Document;
  menu: TileContextMenuHandle;
  actions: Array<{ act: string; ref: string | null; kind: string }>;
  selected: Set<string>;
  tile(ref: string): HTMLElement;
  openMenuEl(): HTMLElement | null;
}

/** Same shape as harness(), plus bulkHtml/isBulkTarget and a caller-supplied
 *  backgroundHtml; onAction records the dispatch `kind` too, which harness()'s
 *  callback ignores. */
function harnessWithBackground(backgroundHtml: () => string): BgHarness {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  (globalThis as Record<string, unknown>).Node = w.Node;

  const doc = w.document;
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  for (const ref of ['a', 'b']) {
    const tile = doc.createElement('article');
    tile.className = 'tile';
    tile.dataset.ref = ref;
    host.appendChild(tile);
  }

  const actions: Array<{ act: string; ref: string | null; kind: string }> = [];
  const selected = new Set<string>();
  const menu = wireTileContextMenu({
    host: host as unknown as HTMLElement,
    tileSelector: '.tile',
    refOf: (tile) => tile.dataset.ref ?? null,
    isBulkTarget: (ref) => selected.size > 1 && selected.has(ref),
    singleHtml: (tgt) => menuItemHtml('one', '', `Act on ${tgt.ref}`),
    bulkHtml: () => `<p class="folder-menu-head">${selected.size} selected</p><div class="folder-menu-list" role="menu">${menuItemHtml('bulk-act', '', 'Bulk')}</div>`,
    backgroundHtml,
    onAction: (act, tgt, kind) => { actions.push({ act, ref: tgt?.ref ?? null, kind }); },
  });

  return {
    host: host as unknown as HTMLElement,
    doc: doc as unknown as Document,
    menu,
    actions,
    selected,
    tile: (ref) => host.querySelector(`[data-ref="${ref}"]`) as HTMLElement,
    openMenuEl: () => doc.querySelector('.folder-menu') as HTMLElement | null,
  };
}

test('right-click on the host background (no tile) opens the background menu; picking a row calls onAction(act, null, "background")', () => {
  const h = harnessWithBackground(() => BG_HTML);
  const e = fire(h.host, 'contextmenu');
  assert.ok(e.defaultPrevented, 'native menu suppressed for a background click');
  const menu = h.openMenuEl();
  assert.ok(menu, 'popover mounted');
  assert.equal(menu!.getAttribute('role'), 'menu');
  assert.match(menu!.innerHTML, /New folder/);
  assert.ok(menu!.querySelector('[data-act="new-folder"]'), 'background rows are the caller\'s html verbatim');

  const row = menu!.querySelector<HTMLElement>('[data-act="new-folder"]')!;
  row.click();
  assert.equal(h.openMenuEl(), null, 'closed before dispatch');
  assert.deepEqual(h.actions, [{ act: 'new-folder', ref: null, kind: 'background' }]);
  h.menu.destroy();
});

test('right-click on a button/link/input inside the host (not in a tile) leaves the native menu alone', () => {
  const h = harnessWithBackground(() => BG_HTML);
  for (const tag of ['button', 'a', 'input']) {
    const el = h.doc.createElement(tag);
    h.host.appendChild(el);
    const e = fire(el, 'contextmenu');
    assert.ok(!e.defaultPrevented, `${tag}: native menu wins`);
    assert.equal(h.openMenuEl(), null, `${tag}: no popover opened`);
  }
  h.menu.destroy();
});

test("backgroundHtml returning '' declines the background menu (native menu, not preventDefault-ed)", () => {
  const h = harnessWithBackground(() => '');
  const e = fire(h.host, 'contextmenu');
  assert.ok(!e.defaultPrevented, 'an empty string declines the same way refOf → null does');
  assert.equal(h.openMenuEl(), null);
  h.menu.destroy();
});

test('without backgroundHtml, a right-click on the host background keeps the old behaviour (native menu, no popover)', () => {
  const h = harness();
  const e = fire(h.host, 'contextmenu');
  assert.ok(!e.defaultPrevented, 'no backgroundHtml means the background branch bails immediately');
  assert.equal(h.openMenuEl(), null);
  h.menu.destroy();
});

test('onAction receives the dispatch kind: "single" for a tile menu, "bulk" for a multi-selection menu', () => {
  const h = harnessWithBackground(() => BG_HTML);

  fire(h.tile('a'), 'contextmenu');
  h.openMenuEl()!.querySelector<HTMLElement>('[data-act="one"]')!.click();
  assert.deepEqual(h.actions, [{ act: 'one', ref: 'a', kind: 'single' }]);

  h.selected.add('a').add('b');
  fire(h.tile('a'), 'contextmenu');
  h.openMenuEl()!.querySelector<HTMLElement>('[data-act="bulk-act"]')!.click();
  assert.deepEqual(h.actions, [
    { act: 'one', ref: 'a', kind: 'single' },
    { act: 'bulk-act', ref: null, kind: 'bulk' },
  ]);

  h.menu.destroy();
});
