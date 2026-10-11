// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import type { DesignPage, DesignPagePort } from './design-ports.ts';
import { mountDesignPages, moveArtboardToPage, reorderDesignPages } from './design-pages.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'MouseEvent', 'Node', 'CustomEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
let raf = 0;
(globalThis as Record<string, unknown>).requestAnimationFrame = (): number => ++raf;
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
const click = (node: Element): void => { node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); };
const key = (node: Element, value: string): void => { node.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true })); };
function fixture(initial: DesignPage[], editable = true) {
  const host = document.createElement('div'); document.body.append(host);
  let pages = initial, active = initial[0]!.id, boxes = [{ id: 'a', kind: 'box' }] as Box[];
  const subscribers = new Set<() => void>(), writes: Array<{ pages: DesignPage[]; boxes: Box[]; label?: string }> = [], actions: string[] = [];
  const fire = (): void => { for (const callback of subscribers) callback(); };
  const port: DesignPagePort = {
    get: () => pages, active: () => active, getBoxes: () => boxes, canEdit: () => editable,
    setActive(id) { active = id; fire(); },
    commit(nextPages, nextBoxes, label) { writes.push({ pages: nextPages, boxes: nextBoxes, label }); pages = nextPages; boxes = nextBoxes; fire(); },
    duplicate: id => { actions.push(`duplicate:${id}`); }, remove: id => { actions.push(`remove:${id}`); },
    onChange(callback) { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
  };
  const handle = mountDesignPages(host, port);
  return { host, port, writes, actions, subscribers, destroy() { handle.destroy(); host.remove(); } };
}

test('page selection is local; creation and rename commit complete document metadata once', () => {
  const f = fixture([{ id: 'one', name: 'Page one' }, { id: 'two', name: '<img onerror=alert(1)>' }]);
  try {
    const row = f.host.querySelector<HTMLElement>('[data-page-id="two"] [data-nav-row]')!;
    assert.equal(row.textContent, '<img onerror=alert(1)>'); assert.equal(row.querySelector('img'), null);
    click(row); assert.equal(f.port.active(), 'two'); assert.equal(f.writes.length, 0);
    const current = f.host.querySelector<HTMLElement>('[data-page-id="two"] [data-nav-row]')!;
    key(current, 'F2'); const input = f.host.querySelector<HTMLInputElement>('input')!; input.value = 'Review'; key(input, 'Enter');
    assert.equal(f.writes.length, 1); assert.equal(f.port.get()[1]!.name, 'Review'); assert.equal(f.port.getBoxes()[0]!.id, 'a');
    click(f.host.querySelector('[data-add-design-page]')!);
    assert.equal(f.writes.length, 2); assert.equal(f.port.get().length, 3);
    assert.equal(f.port.active(), f.port.get()[2]!.id); assert.notEqual(f.port.active(), 'one');
  } finally { f.destroy(); }
  assert.equal(f.subscribers.size, 0);
});

test('readonly pages remain navigable while document writes and menu verbs are disabled', () => {
  const f = fixture([{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], false);
  try {
    click(f.host.querySelector('[data-page-id="two"] [data-nav-row]')!); assert.equal(f.port.active(), 'two');
    const add = f.host.querySelector<HTMLButtonElement>('[data-add-design-page]')!; assert.equal(add.disabled, true); add.click();
    key(f.host.querySelector('[data-page-id="two"] [data-nav-row]')!, 'F2'); assert.equal(f.host.querySelector('input'), null); assert.equal(f.writes.length, 0);
  } finally { f.destroy(); }
});

test('artboard moves include nested groups, layout children and descendants without changing geometry', () => {
  const pages = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  const boxes = [
    { id: 'f', kind: 'frame', pageId: 'one', x: 120, y: 90, w: 800, h: 600 },
    { id: 'g', kind: 'group', frame: 'f', x: 140, y: 100, w: 200, h: 100 },
    { id: 'nested', kind: 'group', group: 'g' },
    { id: 'leaf', kind: 'text', group: 'nested', x: 150, y: 110, w: 100, h: 50 },
    { id: 'layout', kind: 'box', frame: 'f', layout: 'flex' },
    { id: 'flow', kind: 'box', layoutOwner: 'layout' },
    { id: 'outside', kind: 'box', pageId: 'one' },
  ] as Box[];
  const next = moveArtboardToPage(boxes, 'f', 'two', pages);
  assert.deepEqual(next.slice(0, 6).map(box => box.pageId), Array(6).fill('two'));
  assert.equal(next[6], boxes[6]);
  for (let i = 0; i < 6; i++) {
    const { pageId: _nextPage, ...nextBox } = next[i]!;
    const { pageId: _sourcePage, ...sourceBox } = boxes[i]!;
    assert.deepEqual(nextBox, sourceBox);
  }
  assert.equal(boxes[0]!.pageId, 'one');
  assert.deepEqual(reorderDesignPages(pages, 'two', -1).map(page => page.id), ['two', 'one']);
});

test('256 pages mount a bounded row window and keyboard navigation reaches the final page', () => {
  const f = fixture(Array.from({ length: 256 }, (_, index) => ({ id: `p${index}`, name: `Page ${index}` })));
  try {
    assert.ok(f.host.querySelectorAll('[data-nav-row]').length <= 120);
    const row = f.host.querySelector<HTMLElement>('[data-nav-row]')!; key(row, 'End');
    assert.equal((document.activeElement as HTMLElement).closest<HTMLElement>('[data-page-id]')!.dataset.pageId, 'p255');
    key(document.activeElement!, 'Enter'); assert.equal(f.port.active(), 'p255'); assert.equal(f.writes.length, 0);
    assert.equal(f.host.querySelector<HTMLButtonElement>('[data-add-design-page]')!.disabled, true);
    assert.ok(f.host.querySelectorAll('[data-nav-row]').length <= 120);
  } finally { f.destroy(); }
});
