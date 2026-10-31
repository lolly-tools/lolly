// SPDX-License-Identifier: MPL-2.0
// A tray that closes by emptying hands focus back to the first control that
// takes focus. On a phone the bar keeps "Add from…" offered (not hidden) but not
// drawn, so focus() on it does nothing; the hand-back used to stop there and
// leave focus on the page. Not being drawn is modelled here as a focus() that
// does not take, which is how a browser treats a display: none button.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/start' });
const original = new Map<string, PropertyDescriptor | undefined>();
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'location', 'localStorage', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle']) {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { handFocusBack } = await import('./shared.ts');

function bar() {
  const shell = document.createElement('div');
  shell.innerHTML = `
    <button type="button" data-start-import>Add from…</button>
    <button type="button" data-ds-more>More actions</button>
    <button type="button" data-ds-room="overview" tabindex="-1">Board</button>
    <button type="button" data-ds-room="color" tabindex="0">Colours</button>`;
  document.body.appendChild(shell);
  const q = (sel: string) => shell.querySelector<HTMLElement>(sel)!;
  return { shell, add: q('[data-start-import]'), more: q('[data-ds-more]'), board: q('[data-ds-room="overview"]'), current: q('[data-ds-room][tabindex="0"]') };
}

/** A control the layout does not draw: focus() leaves focus where it was. */
const notDrawn = (el: HTMLElement): void => { el.focus = () => {}; };

test('"Add from…" takes focus wherever it is drawn', () => {
  const b = bar();
  try {
    assert.equal(handFocusBack([b.add, b.more, b.current]), b.add);
    assert.equal(document.activeElement, b.add);
  } finally { b.shell.remove(); }
});

test('on a phone "Add from…" is not drawn, so More takes focus', () => {
  const b = bar();
  try {
    (document.activeElement as HTMLElement | null)?.blur();
    notDrawn(b.add);
    assert.equal(handFocusBack([b.add, b.more, b.current]), b.more);
    assert.equal(document.activeElement, b.more, 'focus is not left on the page');
  } finally { b.shell.remove(); }
});

test('a hidden target is skipped, and the strip\'s own stop comes after More', () => {
  const b = bar();
  try {
    b.add.hidden = true;
    notDrawn(b.more);
    assert.equal(handFocusBack([b.add, b.more, b.current, b.board]), b.current);
    assert.equal(document.activeElement, b.current);
  } finally { b.shell.remove(); }
});

test('nothing that takes focus: null, and nothing is forced', () => {
  const b = bar();
  try {
    (document.activeElement as HTMLElement | null)?.blur();
    for (const el of [b.add, b.more]) notDrawn(el);
    assert.equal(handFocusBack([b.add, b.more, null, undefined]), null);
    assert.equal(document.activeElement, document.body);
  } finally { b.shell.remove(); }
});
