// SPDX-License-Identifier: MPL-2.0
// The studio bar's emphasis follows whose system it is (plan 346, change 1).
// While the system came with the app, "Make it yours" is the filled action and
// Export is outlined; once it is the person's own, Make it yours steps aside,
// Add from… returns and Export takes the fill back. The blank studio's Board
// doors are the first move, so the bar adds none.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/start' });
const original = new Map<string, PropertyDescriptor | undefined>();
for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'location', 'localStorage', 'navigator', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { renderShell } = await import('./navigation.ts');
const { applyEmphasis, makeItems } = await import('./bar.ts');
type Start = Parameters<typeof renderShell>[0];

const LABELS = { overview: 'Board', color: 'Colours', type: 'Type', logos: 'Logos', tokens: 'Tokens', catalogue: 'Files', usage: 'Rules', skills: 'Skills', versions: 'Versions' };

/** The real shell markup, with Export already offered (the worth-exporting latch). */
function studio(): { start: Start; make: HTMLButtonElement; exportBtn: HTMLButtonElement; importBtn: HTMLButtonElement; done: () => void } {
  const viewEl = document.createElement('main');
  document.body.appendChild(viewEl);
  const start = { ROOM_LABELS: LABELS, backPill: '', homeFab: '', viewEl, activeArea: 'overview' } as unknown as Start;
  renderShell(start);
  const shell = viewEl.querySelector<HTMLElement>('.start')!;
  const exportBtn = shell.querySelector<HTMLButtonElement>('[data-start-export]')!;
  exportBtn.hidden = false;
  Object.assign(start, { shell, importBtn: shell.querySelector<HTMLButtonElement>('[data-start-import]'), boardState: null });
  return {
    start, exportBtn,
    make: shell.querySelector<HTMLButtonElement>('[data-start-make]')!,
    importBtn: shell.querySelector<HTMLButtonElement>('[data-start-import]')!,
    done: () => viewEl.remove(),
  };
}

test('the shell carries Make it yours as a menu button, hidden until it applies', () => {
  const s = studio();
  try {
    assert.equal(s.make.hidden, true);
    assert.equal(s.make.getAttribute('aria-haspopup'), 'menu');
    assert.equal(s.make.getAttribute('aria-expanded'), 'false');
    assert.ok(s.make.classList.contains('be-cta'), 'drawn filled');
    assert.match(s.make.textContent ?? '', /Make it yours/);
    const acts = [...s.start.shell.querySelectorAll('.ds-bar-acts > button')].map(b => (b as HTMLElement).dataset);
    assert.ok(acts.findIndex(d => 'startMake' in d) < acts.findIndex(d => 'startExport' in d), 'Make it yours comes before Export');
  } finally { s.done(); }
});

test('unowned: Make it yours is filled, Add from… waits in its menu, Export is outlined', () => {
  const s = studio();
  try {
    s.start.boardState = 'unowned';
    applyEmphasis(s.start);
    assert.equal(s.make.hidden, false);
    assert.equal(s.importBtn.hidden, true);
    assert.ok(s.exportBtn.classList.contains('be-btn'), 'Export in outline');
    assert.equal(s.exportBtn.classList.contains('be-cta'), false, 'and no longer filled');
    assert.equal(s.exportBtn.hidden, false, 'still offered: the emphasis never hides it');
    assert.equal(s.start.shell.dataset.boardState, 'unowned');
  } finally { s.done(); }
});

test('owned: Make it yours steps aside, Add from… returns and Export takes the fill back', () => {
  const s = studio();
  try {
    s.start.boardState = 'unowned';
    applyEmphasis(s.start);
    s.start.boardState = 'owned';
    applyEmphasis(s.start);
    assert.equal(s.make.hidden, true);
    assert.equal(s.importBtn.hidden, false);
    assert.ok(s.exportBtn.classList.contains('be-cta'));
    assert.equal(s.exportBtn.classList.contains('be-btn'), false);
  } finally { s.done(); }
});

test('blank: the Board\'s doors are the first move, so the bar adds none', () => {
  const s = studio();
  try {
    s.start.boardState = 'blank';
    applyEmphasis(s.start);
    assert.equal(s.make.hidden, true);
    assert.equal(s.importBtn.hidden, true, 'Add from… would only repeat a door');
  } finally { s.done(); }
});

test('the menu offers the Board\'s first moves, in its order, and each reaches its control', () => {
  const calls: string[] = [];
  const start = {
    looks: { openLooks: async () => { calls.push('looks'); } },
    sources: { openImport: () => { calls.push('import'); } },
    rooms: { selectRoom: (area: string) => { calls.push(`room:${area}`); }, openFocus: (area: string, focus: string) => { calls.push(`focus:${area}:${focus}`); } },
  } as unknown as Start;
  const items = makeItems(start);
  assert.deepEqual(items.map(i => i.label), ['Find a look', 'Add from…', 'Pick a colour']);
  for (const item of items) item.press();
  assert.deepEqual(calls, ['looks', 'import', 'room:color', 'focus:color:pick']);
});
