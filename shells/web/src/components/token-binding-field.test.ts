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


test('overlapping token actions remain pending until every lookup finishes', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const finishes: Array<(value: ReturnType<typeof createTokenSet>) => void> = [];
  const host = { tokens: { get: () => new Promise<ReturnType<typeof createTokenSet>>(resolve => { finishes.push(resolve); }) } } as HostV1;
  const pending: boolean[] = [];
  const dispose = mountTokenBindingField(root, { id: 'gap', type: 'number', value: 12 } as InputModelItem, host, () => {}, { restoreRef: '{gap}', onPendingChange: value => { pending.push(value); } });
  const button = root.querySelector<HTMLButtonElement>('[data-token-restore]')!;
  button.click(); button.click();
  assert.deepEqual(pending, [true]);
  const set = createTokenSet({ gap: { $type: 'number', $value: 36 } });
  finishes[0]!(set); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(pending, [true]);
  finishes[1]!(set); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(pending, [true, false]);
  dispose(); dom.window.close();
});

test('transition candidates explain incompatibility and require an explicit enabled Link action', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const transition = (delay: number) => ({ $type: 'transition', $value: { duration: { value: 800, unit: 'ms' }, delay: { value: delay, unit: 'ms' }, timingFunction: [0.2, 0.8, 0.4, 1] } });
  const set = createTokenSet({ ready: transition(0), delayed: transition(100), scalar: { $type: 'number', $value: 800 } });
  const commits: InputValue[] = [];
  const dispose = mountTokenBindingField(root, { id: 'enter', type: 'text', value: '' } as InputModelItem, { tokens: { get: async () => set } } as HostV1, value => { commits.push(value); }, { consumer: { type: 'text', adapter: 'transition', min: 100, max: 3000 }, candidateType: 'transition' });
  try {
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await new Promise(resolve => setTimeout(resolve, 0));
    const picker = root.querySelector<HTMLSelectElement>('select')!, button = root.querySelector<HTMLButtonElement>('[data-token-link]')!;
    assert.equal(button.disabled, true); assert.equal(button.hidden, false); assert.ok(![...picker.options].some(option => option.value === 'scalar'));
    picker.value = 'delayed'; picker.dispatchEvent(new dom.window.Event('change')); assert.equal(button.disabled, true);
    assert.match(picker.selectedOptions[0]!.text, /Incompatible/); assert.match(root.querySelector('[data-token-message]')!.textContent!, /cannot apply a delay/);
    button.click(); assert.equal(commits.length, 0);
    picker.value = 'ready'; picker.dispatchEvent(new dom.window.Event('change')); assert.equal(button.disabled, false); assert.equal(commits.length, 0); assert.equal(root.querySelector('[data-token-message]')!.textContent, '');
    button.click(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(commits.length, 1); assert.equal((commits[0] as { ref: string }).ref, '{ready}');
    picker.value = ''; picker.dispatchEvent(new dom.window.Event('change')); assert.equal(button.disabled, true);
  } finally { dispose(); dom.window.close(); }
});

test('an explicit transition action rechecks current compatibility and does not commit after disposal', async () => {
  for (const disposePending of [false, true]) {
    const dom = new JSDOM('<main></main>');
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
    const root = dom.window.document.querySelector<HTMLElement>('main')!;
    const transition = (delay: number) => createTokenSet({ motion: { $type: 'transition', $value: { duration: { value: 800, unit: 'ms' }, delay: { value: delay, unit: 'ms' }, timingFunction: [0.2, 0.8, 0.4, 1] } } });
    let calls = 0, finish: (value: ReturnType<typeof createTokenSet>) => void = () => {};
    const pending = new Promise<ReturnType<typeof createTokenSet>>(resolve => { finish = resolve; });
    let commits = 0;
    const dispose = mountTokenBindingField(root, { id: 'enter', type: 'text', value: '' } as InputModelItem, { tokens: { get: () => ++calls === 1 ? Promise.resolve(transition(0)) : pending } } as HostV1, () => { commits++; }, { consumer: { type: 'text', adapter: 'transition', min: 100, max: 3000 }, candidateType: 'transition' });
    try {
      root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await new Promise(resolve => setTimeout(resolve, 0));
      const picker = root.querySelector<HTMLSelectElement>('select')!; picker.value = 'motion'; picker.dispatchEvent(new dom.window.Event('change'));
      root.querySelector<HTMLButtonElement>('[data-token-link]')!.click(); assert.equal(calls, 2);
      if (disposePending) dispose(); finish(transition(disposePending ? 0 : 100)); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(commits, 0);
      if (!disposePending) { assert.match(root.querySelector('[data-token-message]')!.textContent!, /cannot apply a delay/); assert.equal(root.querySelector<HTMLButtonElement>('[data-token-link]')!.disabled, true); }
    } finally { dispose(); dom.window.close(); }
  }
});

test('ordinary scalar candidates retain immediate selection without a separate Link button', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = dom.window.document.querySelector<HTMLElement>('main')!;
  const set = createTokenSet({ gap: { $type: 'number', $value: 36 } });
  const commits: InputValue[] = [];
  const dispose = mountTokenBindingField(root, { id: 'gap', type: 'number', value: 12 } as InputModelItem, { tokens: { get: async () => set } } as HostV1, value => { commits.push(value); });
  try {
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(root.querySelector('[data-token-link]'), null);
    const picker = root.querySelector<HTMLSelectElement>('select')!; picker.value = 'gap'; picker.dispatchEvent(new dom.window.Event('change')); await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(commits, [{ ref: '{gap}', value: 36 }]);
  } finally { dispose(); dom.window.close(); }
});
