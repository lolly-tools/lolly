// SPDX-License-Identifier: MPL-2.0
// The studio shell has one level-one heading. The bar's title is an editable
// field, and a field is no heading, so the heading is the label before it, with
// a screen-reader copy of the name that brand.ts fills in.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/start' });
const original = new Map<string, PropertyDescriptor | undefined>();
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'location', 'localStorage', 'navigator', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle']) {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { renderShell } = await import('./navigation.ts');
type Start = Parameters<typeof renderShell>[0];

test('the shell renders one h1: the bar label, with a slot for the name', () => {
  const viewEl = document.createElement('main');
  document.body.appendChild(viewEl);
  try {
    const labels = { overview: 'Board', color: 'Colours', type: 'Type', logos: 'Logos', tokens: 'Tokens', catalogue: 'Files', usage: 'Rules', skills: 'Skills', versions: 'Versions' };
    renderShell({ ROOM_LABELS: labels, backPill: '', homeFab: '', viewEl, activeArea: 'overview' } as unknown as Start);
    const headings = viewEl.querySelectorAll('h1');
    assert.equal(headings.length, 1, 'one level-one heading');
    const h1 = headings[0]!;
    assert.ok(h1.closest('.ds-bar'), 'the heading sits in the bar');
    assert.match(h1.textContent ?? '', /Design system/);
    const slot = h1.querySelector<HTMLElement>('[data-start-ds-heading]');
    assert.ok(slot, 'the heading holds the slot brand.ts writes the name into');
    assert.ok(slot.classList.contains('visually-hidden'), 'the name in the heading is for a screen reader; the field shows it on screen');
    assert.equal(viewEl.querySelector('h1, h2, h3, h4, h5, h6'), h1, 'the h1 comes before any other heading');
  } finally { viewEl.remove(); }
});
