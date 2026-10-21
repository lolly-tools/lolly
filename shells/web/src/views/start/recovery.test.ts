// SPDX-License-Identifier: MPL-2.0
// Restore brand settings shows once a checkpoint exists, and keeps being asked
// for after Export has latched: the first checkpoint is usually written later
// than that (an import's "Before import", a palette replace).
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

const { refreshFurnished } = await import('./rooms.ts');
type Start = Parameters<typeof refreshFurnished>[0];

function startWith(checkpoints: () => unknown[]) {
  const shell = document.createElement('div');
  shell.innerHTML = '<button type="button" data-start-recovery hidden>Restore brand settings</button>';
  document.body.appendChild(shell);
  let asked = 0;
  const start = {
    host: { assets: {} },
    shell,
    worthExporting: true,
    studio: { listCheckpoints: async () => { asked++; return checkpoints(); } },
  } as unknown as Start;
  return { start, shell, asked: () => asked, button: shell.querySelector<HTMLElement>('[data-start-recovery]')! };
}
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('Export already latched: a checkpoint written later still reveals Restore', async () => {
  let list: unknown[] = [];
  const s = startWith(() => list);
  try {
    refreshFurnished(s.start);
    await tick();
    assert.equal(s.button.hidden, true, 'no checkpoint, no door');
    list = [{ id: 'before-import' }];
    refreshFurnished(s.start);
    await tick();
    assert.equal(s.button.hidden, false, 'the import wrote one, and the next refresh shows the door');
    const before = s.asked();
    refreshFurnished(s.start);
    await tick();
    assert.equal(s.asked(), before, 'once shown, the checkpoints are not read again');
  } finally { s.shell.remove(); }
});
