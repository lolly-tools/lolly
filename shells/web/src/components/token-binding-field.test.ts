// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { mountTokenBindingField } from './token-binding-field.ts';

test('restoring a link reads its current value and read-only fields expose no mutation controls', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const set = createTokenSet({ gap: { $type: 'dimension', $value: { value: 36, unit: 'px' } } });
  const host = { tokens: { get: async () => set } } as unknown as HostV1;
  const input = { id: 'gap', type: 'number', value: 12, min: 0, max: 100 } as InputModelItem;
  const commits: InputValue[] = [];
  let dispose = mountTokenBindingField(root, input, host, value => { commits.push(value); }, { restoreRef: '{gap}' });
  root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual([...commits], [{ ref: '{gap}', value: 36 }]);
  dispose();
  dispose = mountTokenBindingField(root, { ...input, value: { ref: '{gap}', value: 36 } }, host, value => { commits.push(value); }, { readOnly: true });
  assert.equal(root.querySelector('[data-token-choose],[data-token-custom],[data-token-restore]'), null);
  assert.ok(root.querySelector('[data-token-inspect]'));
  dispose(); dom.window.close();
});

test('an async link lookup cannot commit after its field is disposed', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  let finish: (value: ReturnType<typeof createTokenSet>) => void;
  const pending = new Promise<ReturnType<typeof createTokenSet>>(resolve => { finish = resolve; });
  const host = { tokens: { get: () => pending } } as unknown as HostV1;
  let commits = 0;
  const dispose = mountTokenBindingField(root, { id: 'gap', type: 'number', value: 12 } as InputModelItem, host, () => { commits++; }, { restoreRef: '{gap}' });
  root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); dispose();
  finish!(createTokenSet({ gap: { $type: 'number', $value: 36 } }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(commits, 0);
  dom.window.close();
});

test('compact fields retain native disclosure semantics and explain a rejected commit', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const input = { id: 'gap', type: 'number', value: { ref: '{gap}', value: 12 } } as InputModelItem;
  const dispose = mountTokenBindingField(root, input, {} as HostV1, async () => { throw new Error('The selection changed.'); }, { compact: true });
  assert.ok(root.querySelector('details > summary'));
  assert.equal(root.querySelector('details')!.open, false);
  root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(root.querySelector('[role="status"]')!.textContent, 'The selection changed.');
  dispose(); dom.window.close();
});
