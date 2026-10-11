// SPDX-License-Identifier: MPL-2.0
/** Projected property restoration uses the same picker and guarded canvas commit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { withBlockTokenBinding, readBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import { mountDesignTokenBindings } from './design-token-bindings.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'AbortController']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const set = createTokenSet({ heading: { $type: 'typography', $value: { fontFamily: 'sans', fontSize: { value: 24, unit: 'px' }, fontWeight: 700, letterSpacing: { value: 0, unit: 'px' }, lineHeight: 1.4 } }, small: { $type: 'dimension', $value: { value: 12, unit: 'px' } } });
const fields = [{ id: 'fontSize', type: 'number' }, { id: 'weight', type: 'select', options: [{ value: '400' }, { value: '700' }] }];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function mount(host: HostV1) {
  let rows: Box[] = [withBlockTokenBinding(withBlockTokenBinding({ id: 'a', fontSize: 24, weight: '400' }, 'links', 'fontSize', { ref: '{heading}', value: 24 }, 'typography.fontSize'), 'links', 'fontSize', 30)];
  let commits = 0;
  const root = document.createElement('div'); document.body.append(root);
  const model: ModelPort = { blockId: 'boxes', cfg: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot', fontSizeField: 'fontSize', weightField: 'weight' } as BoxFieldConfig, frame: null, getBoxes: () => rows, commit: next => { rows = next; commits++; }, setField: () => {}, subscribe: () => () => {}, getInput: () => 'sdr', setInput: () => {} };
  const destroy = mountDesignTokenBindings(root, { host, metadataField: 'links', fields, fieldIds: ['fontSize', 'weight'], model, ids: ['a'] });
  return { root, rows: () => rows, commits: () => commits, destroy: () => { destroy(); root.remove(); } };
}
test('individual projected restore succeeds and scalar replacement remains available', async () => {
  const h = mount({ tokens: { get: async () => set } } as HostV1);
  try {
    const properties = h.root.querySelector<HTMLSelectElement>('[data-design-token-property]')!;
    assert.ok([...properties.options].some(option => option.value === 'weight'));
    h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.equal(h.commits(), 1); assert.equal(h.rows()[0]!.fontSize, 24); assert.equal(readBlockTokenBindings(h.rows()[0]!.links).fontSize?.adapter, 'typography.fontSize');
  } finally { h.destroy(); }
  const replacement = mount({ tokens: { get: async () => set } } as HostV1);
  try {
    replacement.root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick();
    const picker = replacement.root.querySelector<HTMLSelectElement>('[data-token-options] select')!;
    assert.ok([...picker.options].some(option => option.value === 'small'));
    picker.value = 'small'; picker.dispatchEvent(new Event('change')); await tick();
    assert.equal(replacement.rows()[0]!.fontSize, 12); assert.equal(readBlockTokenBindings(replacement.rows()[0]!.links).fontSize?.adapter, undefined);
  } finally { replacement.destroy(); }
});
test('changing property during the second token lookup cancels the old commit', async () => {
  let finish: (value: typeof set) => void = () => {}, calls = 0;
  const pending = new Promise<typeof set>(resolve => { finish = resolve; });
  const h = mount({ tokens: { get: () => ++calls === 1 ? Promise.resolve(set) : pending } } as HostV1);
  try {
    h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick(); assert.equal(calls, 2);
    const picker = h.root.querySelector<HTMLSelectElement>('[data-design-token-property]')!; picker.value = 'weight'; picker.dispatchEvent(new Event('change'));
    finish(set); await tick(); assert.equal(h.commits(), 0); assert.equal(h.rows()[0]!.fontSize, 30);
  } finally { h.destroy(); }
});
