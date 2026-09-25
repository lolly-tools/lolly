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

// ── the menu as a bottom sheet (plan 275 close-out CP6b) ─────────────────────

interface SheetHarness {
  doc: Document;
  win: Window & typeof globalThis;
  host: HTMLElement;
  menu: TileContextMenuHandle;
  actions: Array<{ act: string; ref: string | null; kind: string }>;
  selected: Set<string>;
  tile(ref: string): HTMLElement;
  mounted(): HTMLElement | null;
}

/**
 * A harness whose window answers `(any-pointer: coarse)` with `coarse`. Every other
 * query answers false, so the popover shell pushes no Back entry under jsdom. Each tile
 * holds a button, the way a real tile holds its pick button, for the focus return.
 */
function sheetHarness(
  coarse: boolean,
  extra: Partial<Parameters<typeof wireTileContextMenu>[0]> = {},
): SheetHarness {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  Object.defineProperty(w, 'matchMedia', { value: (q: string) => ({ matches: coarse && q === '(any-pointer: coarse)' }) });
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
    tile.innerHTML = `<button type="button" class="pick">Slide ${ref}</button>`;
    host.appendChild(tile);
  }
  const actions: Array<{ act: string; ref: string | null; kind: string }> = [];
  const selected = new Set<string>();
  const menu = wireTileContextMenu({
    host: host as unknown as HTMLElement,
    tileSelector: '.tile',
    refOf: (tile) => tile.dataset.ref ?? null,
    isBulkTarget: (ref) => selected.size > 1 && selected.has(ref),
    singleHtml: (tgt) => menuItemHtml('one', '', `Act on ${tgt.ref}`) + menuItemHtml('off', '', 'Open in Design', { reason: 'Answer or accept 5 cards first.' }),
    bulkHtml: () => `<p class="folder-menu-head">${selected.size} selected</p><div class="folder-menu-list" role="menu">${menuItemHtml('bulk-act', '', 'Bulk')}</div>`,
    onAction: (act, tgt, kind) => { actions.push({ act, ref: tgt?.ref ?? null, kind }); },
    ...extra,
  });
  return {
    doc: doc as unknown as Document,
    win: w as unknown as Window & typeof globalThis,
    host: host as unknown as HTMLElement,
    menu,
    actions,
    selected,
    tile: (ref) => host.querySelector(`[data-ref="${ref}"]`) as HTMLElement,
    mounted: () => doc.querySelector('.ctx-menu') as HTMLElement | null,
  };
}

const SHEET = { presentation: 'sheet' as const, head: (tgt: { ref: string } | null) => (tgt ? { name: `Slide ${tgt.ref}`, thumb: '<svg viewBox="0 0 16 9"></svg>' } : null) };

/** A tap: the press, then the click the browser makes of it (detail 1). */
function tap(el: HTMLElement): void {
  const w = el.ownerDocument!.defaultView!;
  el.dispatchEvent(Object.assign(new w.Event('pointerdown', { bubbles: true, cancelable: true }), { pointerType: 'touch', button: 0 }));
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}

test('menuItemHtml writes the same row as before, and a reason makes a focusable disabled row that says why', () => {
  assert.equal(
    menuItemHtml('open', '<svg></svg>', 'Open & go', { danger: true }),
    '<button type="button" class="folder-menu-item folder-menu-item--danger" role="menuitem" data-act="open"><svg></svg><span>Open &amp; go</span></button>',
  );
  const off = menuItemHtml('design', '', 'Open in Design', { reason: 'Answer 5 cards first.' });
  assert.match(off, /aria-disabled="true"/);
  assert.doesNotMatch(off, / disabled[ >]/, 'aria-disabled, not disabled, so the row can take focus');
  assert.match(off, /aria-describedby="ctx-why-design"/);
  assert.match(off, /<small class="folder-menu-reason" id="ctx-why-design" aria-hidden="true">Answer 5 cards first\.<\/small>/,
    'the reason describes the row and stays out of its name');
});

test('a caller that does not opt in gets the same popover under a coarse pointer', () => {
  const h = sheetHarness(true);
  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  const el = h.mounted()!;
  assert.equal(el.className, 'folder-menu ctx-menu');
  assert.equal(el.getAttribute('role'), 'menu');
  assert.equal(el.hasAttribute('aria-modal'), false);
  assert.equal(el.innerHTML, menuItemHtml('one', '', 'Act on a') + menuItemHtml('off', '', 'Open in Design', { reason: 'Answer or accept 5 cards first.' }),
    'the rows are the caller\'s markup verbatim, with nothing wrapped round them');
  assert.equal(h.doc.querySelector('.ctx-sheet, [data-sheet-scrim], [data-sheet-cancel]'), null);
  h.menu.destroy();
});

test('an opted-in menu on a fine pointer is the popover, unchanged', () => {
  const h = sheetHarness(false, SHEET);
  fire(h.tile('a'), 'contextmenu', { pointerType: 'mouse' });
  const el = h.mounted()!;
  assert.equal(el.className, 'folder-menu ctx-menu');
  assert.equal(el.getAttribute('role'), 'menu');
  assert.equal(h.doc.querySelector('.ctx-sheet'), null);
  h.menu.destroy();
});

test('a mouse right-click on a touch laptop keeps the popover; a touch hold on the same device gets the sheet', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = sheetHarness(true, SHEET);
  fire(h.tile('a'), 'contextmenu', { pointerType: 'mouse' });
  assert.equal(h.mounted()!.className, 'folder-menu ctx-menu');
  h.menu.close();

  fire(h.tile('a'), 'pointerdown', { pointerType: 'touch' });
  t.mock.timers.tick(420);
  assert.equal(h.mounted()!.className, 'ctx-menu ctx-sheet-host');
  h.menu.destroy();
  t.mock.timers.reset();
});

test('under a coarse pointer an opted-in menu is a sheet: a labelled dialog with a head, a scrim, the rows and a Cancel row', () => {
  const h = sheetHarness(true, SHEET);
  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  const el = h.mounted()!;
  assert.equal(el.getAttribute('role'), 'dialog');
  assert.equal(el.getAttribute('aria-modal'), 'true');
  assert.equal(el.style.left, '', 'the sheet is placed by its CSS, not at the finger');
  const name = el.querySelector<HTMLElement>('.ctx-sheet-head .ctx-sheet-name')!;
  assert.equal(name.textContent, 'Slide a');
  assert.equal(el.getAttribute('aria-labelledby'), name.id);
  assert.ok(el.querySelector('.ctx-sheet-thumb[aria-hidden="true"] > svg'), 'the picture is part of the head, hidden from the reader');
  const list = el.querySelector<HTMLElement>('.ctx-sheet-list')!;
  assert.equal(list.getAttribute('role'), 'menu');
  assert.equal(list.getAttribute('aria-labelledby'), name.id);
  assert.equal(list.querySelectorAll('[role="menuitem"]').length, 2);
  // The scrim is the container's own first child, so the sheet needs nothing from the shell.
  assert.equal(el.firstElementChild?.getAttribute('data-sheet-scrim'), '');
  assert.equal(el.querySelector('[data-sheet-cancel]')?.textContent, 'Cancel');
  assert.equal(h.doc.activeElement, el, 'a finger open focuses the sheet itself, so no row looks chosen');
  assert.equal(el.tabIndex, -1);
  h.menu.destroy();
});

test('the sheet: opened from a button or the keyboard, focus starts on the first row; from a finger, Shift+Tab stays inside', () => {
  const h = sheetHarness(true, SHEET);
  const kebab = h.doc.createElement('button');
  h.tile('a').appendChild(kebab);
  h.menu.openAt(0, 0, { ref: 'a', tile: h.tile('a') }, kebab);
  assert.equal(h.doc.activeElement, h.mounted()!.querySelector('[data-act="one"]'));
  assert.equal(h.mounted()!.hasAttribute('tabindex'), false);
  h.menu.close();

  // The context-menu key on a tablet keyboard: a contextmenu with no pointer type.
  fire(h.tile('a'), 'contextmenu');
  assert.equal(h.doc.activeElement, h.mounted()!.querySelector('[data-act="one"]'));
  h.menu.close();

  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  const el = h.mounted()!;
  assert.equal(h.doc.activeElement, el);
  const back = new h.win.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  el.dispatchEvent(back);
  assert.equal(back.defaultPrevented, true);
  assert.equal(h.doc.activeElement, el.querySelector('[data-sheet-cancel]'), 'Shift+Tab wraps to Cancel, not out of the sheet');
  h.menu.destroy();
});

test('the sheet: a tap on a row runs it; a disabled row does nothing; the release of the opening hold picks nothing', () => {
  const h = sheetHarness(true, SHEET);
  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  const row = h.mounted()!.querySelector<HTMLElement>('[data-act="one"]')!;
  // A click with no press in the sheet is the finger lifting from the hold that opened it.
  row.dispatchEvent(new h.win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert.ok(h.mounted(), 'still open');
  assert.deepEqual(h.actions, []);

  tap(h.mounted()!.querySelector<HTMLElement>('[data-act="off"]')!);
  assert.ok(h.mounted(), 'a disabled row keeps the sheet open');
  assert.deepEqual(h.actions, []);

  // The same release sends a compatibility mousedown, which must not move focus to that row.
  const early = new h.win.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  h.mounted()!.querySelector<HTMLElement>('[data-act="off"]')!.dispatchEvent(early);
  assert.equal(early.defaultPrevented, true, 'a mousedown with no press in the sheet is cancelled');
  row.dispatchEvent(Object.assign(new h.win.Event('pointerdown', { bubbles: true, cancelable: true }), { pointerType: 'touch', button: 0 }));
  const own = new h.win.MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(own);
  assert.equal(own.defaultPrevented, false, 'a press that began in the sheet keeps its mousedown');

  tap(row);
  assert.equal(h.mounted(), null, 'closed before the action ran');
  assert.deepEqual(h.actions, [{ act: 'one', ref: 'a', kind: 'single' }]);
  h.menu.destroy();
});

test('the sheet: Cancel and a tap on the scrim close it and give focus back to the tile; Escape closes it too', () => {
  const h = sheetHarness(true, SHEET);
  const pick = h.tile('a').querySelector<HTMLElement>('.pick')!;

  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  tap(h.mounted()!.querySelector<HTMLElement>('[data-sheet-cancel]')!);
  assert.equal(h.mounted(), null);
  assert.equal(h.doc.activeElement, pick, 'Cancel returns focus to what opened the sheet');
  assert.deepEqual(h.actions, []);

  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  const scrim = h.mounted()!.querySelector<HTMLElement>('[data-sheet-scrim]')!;
  // A click that did not start on the scrim is the opening hold's release: ignored.
  scrim.dispatchEvent(new h.win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert.ok(h.mounted(), 'the hold release does not close it');
  h.doc.body.focus();
  tap(scrim);
  assert.equal(h.mounted(), null, 'a tap on the scrim closes it');
  assert.equal(h.doc.activeElement, pick);

  fire(h.tile('a'), 'contextmenu', { pointerType: 'touch' });
  h.doc.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(h.mounted(), null, 'Escape closes it');
  assert.deepEqual(h.actions, []);
  h.menu.destroy();
});

test('the sheet: a kebab-opened sheet returns focus to the kebab, and a keyboard Enter on a row runs it', () => {
  const h = sheetHarness(true, SHEET);
  const kebab = h.doc.createElement('button');
  h.tile('b').appendChild(kebab);
  fire(kebab, 'pointerdown', { pointerType: 'touch' });
  h.menu.openAt(0, 0, { ref: 'b', tile: h.tile('b') }, kebab);
  assert.equal(kebab.getAttribute('aria-expanded'), 'true');
  tap(h.mounted()!.querySelector<HTMLElement>('[data-sheet-cancel]')!);
  assert.equal(h.doc.activeElement, kebab);
  assert.equal(kebab.getAttribute('aria-expanded'), 'false');

  h.menu.openAt(0, 0, { ref: 'b', tile: h.tile('b') }, kebab);
  h.mounted()!.querySelector<HTMLElement>('[data-act="one"]')!.click(); // a keyboard activation has no press
  assert.deepEqual(h.actions, [{ act: 'one', ref: 'b', kind: 'single' }]);
  h.menu.destroy();
});

test('the sheet: a bulk menu keeps its count line as the head, or gives way to a head the caller names', () => {
  const plain = sheetHarness(true, { presentation: 'sheet' });
  plain.selected.add('a').add('b');
  fire(plain.tile('a'), 'contextmenu', { pointerType: 'touch' });
  let el = plain.mounted()!;
  const count = el.querySelector<HTMLElement>('.ctx-sheet-body > .folder-menu-head')!;
  assert.equal(count.textContent, '2 selected');
  assert.equal(el.getAttribute('aria-labelledby'), count.id);
  assert.equal(el.querySelector('.ctx-sheet-body [role="menu"]')?.getAttribute('aria-labelledby'), count.id);
  assert.equal(el.querySelector('.ctx-sheet-head'), null);
  plain.menu.destroy();

  const named = sheetHarness(true, { presentation: 'sheet', head: (_tgt, kind) => (kind === 'bulk' ? { name: '2 slides' } : null) });
  named.selected.add('a').add('b');
  fire(named.tile('a'), 'contextmenu', { pointerType: 'touch' });
  el = named.mounted()!;
  assert.equal(el.querySelector('.ctx-sheet-head .ctx-sheet-name')?.textContent, '2 slides');
  assert.equal(el.querySelector('.folder-menu-head'), null, 'one head, not two');
  tap(el.querySelector<HTMLElement>('[data-act="bulk-act"]')!);
  assert.deepEqual(named.actions, [{ act: 'bulk-act', ref: null, kind: 'bulk' }]);
  named.menu.destroy();
});

test('tileAt resolves a tile the browser cannot hit-test (a Cover Flow cover), but never under a control', () => {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  Object.assign(globalThis as Record<string, unknown>, { window: w, document: w.document, HTMLElement: w.HTMLElement, Node: w.Node });
  const doc = w.document;
  const host = doc.createElement('div');
  host.innerHTML = '<ul class="track"><li class="ftile" data-tool="cover"></li></ul><button class="go">Open</button>';
  doc.body.appendChild(host);
  const asked: Array<[number, number]> = [];
  const menu = wireTileContextMenu({
    host: host as unknown as HTMLElement,
    tileSelector: '.ftile',
    refOf: (tile) => tile.dataset.tool ?? null,
    tileAt: (x, y) => { asked.push([x, y]); return host.querySelector<HTMLElement>('.ftile') as unknown as HTMLElement; },
    singleHtml: (tgt) => menuItemHtml('open', '', `Open ${tgt.ref}`),
    onAction: () => {},
  });
  // The event targets the track, as Chrome's hit test does inside the 3-D fan.
  const e = fire(host.querySelector('.track') as unknown as HTMLElement, 'contextmenu', { clientX: 40, clientY: 50 });
  assert.ok(e.defaultPrevented);
  assert.deepEqual(asked, [[40, 50]]);
  assert.match(doc.querySelector('.folder-menu')?.textContent ?? '', /Open cover/);
  menu.close();
  // A control keeps its native menu; the fallback is not even asked.
  const e2 = fire(host.querySelector('.go') as unknown as HTMLElement, 'contextmenu');
  assert.ok(!e2.defaultPrevented);
  assert.equal(asked.length, 1);
  menu.destroy();
});
