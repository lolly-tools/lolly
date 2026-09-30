// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { clearInputPolicies, setToolInputPolicies } from './input-policy.ts';
import { mountTokenInputActions } from './input-token-actions.ts';

test('input token actions honor narrowed choices and read-only policies', async () => {
  const dom = new JSDOM('<main></main>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
  const root = document.querySelector<HTMLElement>('main')!;
  const input = { id: 'family', type: 'select', control: 'select', value: 'A', options: [{ value: 'A' }, { value: 'B' }] } as InputModelItem;
  const commits: InputValue[] = [];
  const runtime = { manifest: { id: 'example' }, getModel: () => [input], setInput: async (_id: string, value: InputValue) => { commits.push(value); } } as unknown as Runtime;
  const set = createTokenSet({ a: { $type: 'string', $value: 'A' }, b: { $type: 'string', $value: 'B' } });
  const host = { tokens: { get: async () => set } } as unknown as HostV1;
  let applied = 0;
  try {
    setToolInputPolicies('example', { family: { mode: 'choice', allow: ['A'] } });
    let dispose = mountTokenInputActions(root, runtime, host, 'family', false, () => { applied++; });
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const select = root.querySelector<HTMLSelectElement>('select')!;
    assert.deepEqual([...select.options].map(option => option.value), ['', 'a']);
    select.value = 'a'; select.dispatchEvent(new dom.window.Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(commits, [{ ref: '{a}', value: 'A' }]);
    assert.equal(applied, 1);
    dispose?.();
    for (const policy of [{ mode: 'locked' }, { mode: 'choice', allow: [] }] as const) {
      setToolInputPolicies('example', { family: policy });
      dispose = mountTokenInputActions(root, runtime, host, 'family', false, () => { applied++; });
      assert.ok(root.textContent?.includes('Read-only'));
      assert.equal(root.querySelector('[data-token-choose],[data-token-custom],[data-token-restore]'), null);
      dispose?.();
    }
    setToolInputPolicies('example', { family: { mode: 'hidden' } });
    assert.equal(mountTokenInputActions(root, runtime, host, 'family', false, () => {}), undefined);
    assert.equal(root.childElementCount, 0);
  } finally { clearInputPolicies(); dom.window.close(); }
});
