// SPDX-License-Identifier: MPL-2.0
/**
 * A named plain write (views/tool/history.ts `namedWrite`, exposed to free-canvas as
 * `history.named`): the undo step of the one setInput it runs takes the editor's name,
 * where the tool view would otherwise read a name from the rows that changed. Plan 311:
 * a Scale changes sizes and content together, which reads as no single gesture, and it
 * stays a plain write so its undo still reverts only its own fields after a peer edit.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-history-named.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// The tool view writes browser-style '.js' specifiers that Vite resolves to the '.ts'
// source; map them here, as tool-actions.test.ts does.
registerHooks({
  resolve(spec: string, ctx: { parentURL?: string }, next: (s: string, c: unknown) => unknown) {
    if (spec.endsWith('.js') && spec.startsWith('.') && ctx.parentURL) {
      const js = new URL(spec, ctx.parentURL);
      if (!existsSync(fileURLToPath(js))) {
        const ts = new URL(spec.replace(/\.js$/, '.ts'), ctx.parentURL);
        if (existsSync(fileURLToPath(ts))) return { url: ts.href, format: 'module-typescript', shortCircuit: true };
      }
    }
    return next(spec, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  Reflect.set(globalThis, k, Reflect.get(dom.window, k));
}
const { namedWrite, transactionActions, writeLabel } = await import('./tool/history.ts');
type Tview = Parameters<typeof writeLabel>[0];

const item = { id: 'boxes', label: 'Layers', canvas: { xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' } };
const before = [{ id: 'a', x: 0, y: 0, w: 100, h: 50, fontSize: 10 }];
const resized = [{ ...before[0]!, w: 200, h: 100 }];
const scaled = [{ ...resized[0]!, fontSize: 20 }];

test('a plain write is named from what changed, unless its editor gave the write a name', () => {
  const tview = {} as Tview;
  assert.equal(writeLabel(tview, item, before, resized), 'Resize');
  assert.equal(writeLabel(tview, item, before, scaled), 'Layers', 'sizes and content together read as no one gesture');
  const seen: string[] = [];
  namedWrite(tview, 'Scale', () => { seen.push(writeLabel(tview, item, before, scaled)); });
  assert.deepEqual(seen, ['Scale']);
  assert.equal(writeLabel(tview, item, before, scaled), 'Layers', 'the name lasts for that write only');
});

test('the name is cleared when the write throws, and an outer name comes back', () => {
  const tview = {} as Tview;
  assert.throws(() => namedWrite(tview, 'Scale', () => { throw new Error('refused'); }), /refused/);
  assert.equal(writeLabel(tview, item, before, resized), 'Resize');
  namedWrite(tview, 'Outer', () => {
    namedWrite(tview, 'Inner', () => assert.equal(writeLabel(tview, item, before, resized), 'Inner'));
    assert.equal(writeLabel(tview, item, before, resized), 'Outer');
  });
});

test('free-canvas reaches namedWrite as history.named, and the setInput wrapper records the name', () => {
  const tview = { history: {}, inputHistory: { endGesture() {}, peekUndo: () => null }, revisionChanged() {} } as unknown as Tview;
  const actions = transactionActions(tview, () => {});
  let label = '';
  actions.named('Scale', () => { label = writeLabel(tview, item, before, scaled); });
  assert.equal(label, 'Scale');
  const setup = readFileSync(join(import.meta.dirname, 'tool', 'setup.ts'), 'utf8');
  const wrap = setup.slice(setup.indexOf('export function wrapSetInput('));
  assert.match(wrap, /label: tview\.history\.writeLabel\(cur, cur\.value, admitted\.value\)/,
    'the undo-recording setInput takes its entry name from writeLabel');
});
