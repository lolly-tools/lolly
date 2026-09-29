// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { LayoutOptionsResult } from '../../../../../engine/src/rebrand-layout-options.ts';
import type { LayoutOptionsRequest } from './stage-layout-options.ts';
import { mountLayoutOptions } from './layout-options-ui.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
for (const key of ['document', 'HTMLElement', 'Element', 'Node'] as const) Reflect.set(globalThis, key, Reflect.get(dom.window, key));
const wait = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
const input = { source: { slides: [{}] } } as LayoutOptionsRequest;
const result: LayoutOptionsResult = { checked: 3, rejected: [], modelUsed: false,
  options: [{ id: 'content', name: 'Content', description: '', frames: [], frameCount: 1, keptObjects: 3, issues: [] }] };

test('a recommendation is only applied after an explicit pick, and the intent travels with the run', async () => {
  const calls: string[] = [];
  const view = mountLayoutOptions({ request: () => input, draw: () => null, preview: () => {}, pick: id => calls.push(id),
    run: async (value, opts) => { assert.equal(value.intent, 'Show steps'); assert.equal(opts.useModel, false); return result; } });
  document.body.append(view.root);
  const field = view.root.querySelector('input')!; field.value = 'Show steps';
  view.root.querySelector<HTMLButtonElement>('[data-key="suggest-layouts"]')!.click();
  await wait();
  assert.deepEqual(calls, []);
  view.root.querySelector<HTMLButtonElement>('[data-layout-option]')!.click();
  assert.deepEqual(calls, [], 'selecting previews without applying');
  view.root.querySelector<HTMLButtonElement>('[data-key="apply-layout-option"]')!.click();
  assert.deepEqual(calls, ['content']);
  view.dispose(); view.root.remove();
});

test('closing during inference aborts the run and ignores its late reply', async () => {
  let signal: AbortSignal | undefined;
  let finish: (result: LayoutOptionsResult) => void = () => {};
  const calls: string[] = [];
  const view = mountLayoutOptions({ request: () => input, draw: () => null, preview: () => {}, pick: id => calls.push(id),
    run: async (_input, opts) => { signal = opts.signal; return new Promise(resolve => { finish = resolve; }); } });
  document.body.append(view.root);
  view.root.querySelector<HTMLButtonElement>('[data-key="suggest-layouts"]')!.click();
  view.dispose();
  assert.equal(signal?.aborted, true);
  finish(result); await wait();
  assert.equal(view.root.querySelector('[data-layout-option]'), null);
  assert.deepEqual(calls, []);
  view.root.remove();
});

test('no passing choices names the fallback and a failed run remains retryable', async () => {
  let tries = 0;
  const view = mountLayoutOptions({ request: () => input, draw: () => null, preview: () => {}, pick: () => assert.fail('No automatic pick'),
    run: async () => { if (++tries === 1) throw new Error('worker failed'); return { ...result, options: [], rejected: [{ id: 'content', issues: ['overflow'] }] }; } });
  document.body.append(view.root);
  const button = view.root.querySelector<HTMLButtonElement>('[data-key="suggest-layouts"]')!;
  button.click(); await wait();
  assert.equal(button.disabled, false);
  assert.match(view.root.textContent ?? '', /could not finish/);
  button.click(); await wait();
  assert.match(view.root.textContent ?? '', /arrangement options/);
  assert.match(view.root.textContent ?? '', /clipping/);
  assert.equal(view.root.querySelector('[data-layout-option]'), null);
  view.dispose(); view.root.remove();
});
