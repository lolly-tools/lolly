// SPDX-License-Identifier: MPL-2.0
/**
 * The programme editor (views/table-workbench.ts) keeps every edit made while the
 * edit before it is still saving. On a long programme a save takes a while, and an
 * edit made meanwhile, such as Undo pressed just after typing, used to be dropped:
 * the grid still showed the typed value, Undo did nothing, and the undo entry was
 * gone.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/table-workbench.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { InputModelItem, TableValue } from '../../../../engine/src/inputs.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/agenda' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
Reflect.set(globalThis, 'history', dom.window.history);
Reflect.set(globalThis, 'location', dom.window.location);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { openTableWorkbench } = await import('./table-workbench.ts');

const spec = { title: 'Edit programme', fields: [{ key: 'title', label: 'Title', primary: true, editor: 'text' as const }] };
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** A workbench whose saves wait until the test lets each one finish. */
function workbench(initial: TableValue) {
  let stored = structuredClone(initial);
  const saves: TableValue[] = [];
  const waiting: Array<() => void> = [];
  openTableWorkbench({
    input: () => ({ id: 'sessions', type: 'table', value: stored, tableEditor: spec }) as unknown as InputModelItem,
    commit: async (value) => {
      saves.push(structuredClone(value));
      await new Promise<void>(resolve => waiting.push(resolve));
      stored = structuredClone(value);
    },
  });
  const root = document.querySelector<HTMLElement>('dialog.table-workbench')!;
  const press = (label: string): void => {
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label)!.click();
  };
  /** Let every save waiting so far finish, then any it queued. */
  const finish = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) {
      await tick();
      const next = waiting.shift();
      if (next) next();
    }
    await tick();
  };
  return { root, press, saves, finish, stored: () => stored };
}

test('Undo pressed while an edit is still saving undoes that edit', async () => {
  const initial: TableValue = { columns: ['Title'], rows: [['Opening']] };
  const w = workbench(initial);
  try {
    w.press('Add row');
    await tick();
    assert.equal(w.saves.length, 1, 'the new row is saving');
    w.press('Undo table edit'); // before that save has finished
    await w.finish();
    assert.equal(w.saves.length, 2, 'the undo is saved too, after the edit');
    assert.deepEqual(w.stored(), initial, 'the programme is back to how it was');
    w.press('Redo table edit');
    await w.finish();
    assert.deepEqual(w.stored().rows, [['Opening'], ['']], 'and Redo brings the row back');
  } finally { w.root.remove(); }
});

test('two edits made while the first is saving are both kept, in order', async () => {
  const w = workbench({ columns: ['Title'], rows: [['Opening']] });
  try {
    w.press('Add row');
    await tick();
    w.press('Add row');
    await w.finish();
    assert.equal(w.saves.length, 2);
    assert.deepEqual(w.stored().rows, [['Opening'], [''], ['']]);
  } finally { w.root.remove(); }
});
