// SPDX-License-Identifier: MPL-2.0
/**
 * The shared text snapshot (story-text.ts `snapshot`, review item A2). The text ports
 * repaint on every frame of a pan, and each repaint parsed the whole text document and
 * every frame's settings again. `snapshot` keeps one reading while the text document
 * and the boxes array are the ones it was read from; `read` still hands every editor a
 * copy of its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { FcCtx } from './context.ts';

const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'CustomEvent', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const { read, snapshot } = await import('./story-text.ts');

function fixture() {
  const model = new Map<string, unknown>([['textDocument', ''], ['boxes', [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10 }]]]);
  const fc = {
    cv: { textDocumentInput: 'textDocument' },
    runtime: { getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })) },
    select: { getBoxes: () => model.get('boxes') },
  } as unknown as FcCtx;
  return { fc, model };
}

test('one reading per text document and boxes array, a fresh one when either changes', () => {
  const { fc, model } = fixture();
  const first = snapshot(fc);
  assert.equal(snapshot(fc), first, 'the same inputs give the same reading');
  assert.deepEqual(first, read(fc), 'and it is what read() parses');
  assert.notEqual(read(fc), read(fc), 'read() still parses a copy of its own each time');
  model.set('boxes', [...(model.get('boxes') as unknown[])]);
  const second = snapshot(fc);
  assert.notEqual(second, first, 'a new boxes array is read again');
  model.set('textDocument', JSON.stringify({ version: 1, stories: [], styles: [], fonts: [] }));
  assert.notEqual(snapshot(fc), second, 'and so is a new text document');
});
