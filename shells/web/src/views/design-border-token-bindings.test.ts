// SPDX-License-Identifier: MPL-2.0
/** Border actions guard the selected stroke and restore its dash precedence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { BlockFieldSpec } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { readBlockTokenBindings, resolveBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import { mountDesignTokenBindings } from './design-token-bindings.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'AbortController']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const kinds = ['path', 'box', 'image', 'frame'];
const fields: BlockFieldSpec[] = [{ id: 'stroke', type: 'color', showFor: kinds }, { id: 'strokeW', type: 'number', min: 0, max: 400, showFor: kinds }, { id: 'strokeDash', type: 'select', showFor: kinds, options: [{ value: '' }, { value: 'dashed' }, { value: 'dotted' }] }, { id: 'strokeDashArray', type: 'text', showFor: ['path'] }, { id: 'strokeDashLen', type: 'number', showFor: ['path'] }, { id: 'strokeGapLen', type: 'number', showFor: ['path'] }];
const set = createTokenSet({ edge: { $type: 'border', $value: { color: '#123456', width: { value: 3, unit: 'pt' }, style: 'dashed' } }, unsupported: { $type: 'border', $value: { color: '#ff0000', width: { value: 3, unit: 'px' }, style: 'double' } } });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function harness(initial: Box[], host = { tokens: { get: async () => set } } as HostV1) {
  let rows = initial, commits = 0;
  const root = document.createElement('div'); document.body.append(root);
  const model: ModelPort = { blockId: 'boxes', cfg: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot', kindField: 'kind', strokeField: 'stroke', strokeWField: 'strokeW', strokeDashField: 'strokeDash', strokeDashArrayField: 'strokeDashArray' } as BoxFieldConfig, frame: null, getBoxes: () => rows, commit: next => { rows = next; commits++; }, setField: () => {}, subscribe: () => () => {}, getInput: () => 'sdr', setInput: () => {} };
  let dispose = () => {};
  let selected = initial.map(row => String(row.id));
  const mount = (ids = selected) => { dispose(); selected = ids; dispose = mountDesignTokenBindings(root, { host, metadataField: 'links', fields, fieldIds: fields.map(field => field.id), model, ids }); };
  mount();
  const property = (id: string) => { const picker = root.querySelector<HTMLSelectElement>('[data-design-token-property]')!; picker.value = id; picker.dispatchEvent(new Event('change')); };
  const choose = async (id = 'edge') => { root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick(); const picker = root.querySelector<HTMLSelectElement>('[data-token-options] select')!; assert.ok([...picker.options].some(option => option.value === id)); picker.value = id; picker.dispatchEvent(new Event('change')); await tick(); };
  return { root, property, choose, remount: mount, rows: () => rows, replace: (next: Box[]) => { rows = next; }, commits: () => commits, destroy: () => { dispose(); root.remove(); } };
}
test('border actions support rendered stroke kinds without offering them on text', () => {
  for (const kind of [...kinds, 'text']) {
    const h = harness([{ id: 'a', kind }]);
    try {
      const properties = [...h.root.querySelectorAll<HTMLOptionElement>('[data-design-token-property] option')].map(option => option.value);
      assert.equal(properties.includes('__border'), kind !== 'text');
      assert.equal(properties.includes('strokeDash'), kind !== 'text');
      assert.equal(properties.includes('strokeDashLen'), false);
      assert.equal(properties.includes('strokeGapLen'), false);
    } finally { h.destroy(); }
  }
});
test('a whole border links mixed layers and their dash overrides in one commit', async () => {
  const h = harness([{ id: 'a', kind: 'path', stroke: '#000000', strokeW: 1, strokeDash: 'dotted', strokeDashArray: '7 3', strokeDashLen: 7, strokeGapLen: 3 }, { id: 'b', kind: 'box', stroke: '#ffffff', strokeW: 2, strokeDash: '' }]);
  try {
    h.property('__border'); assert.match(h.root.textContent!, /Mixed values/);
    await h.choose(); assert.equal(h.commits(), 1);
    for (const row of h.rows()) {
      assert.deepEqual([row.stroke, row.strokeW, row.strokeDash, row.strokeDashArray, row.strokeDashLen, row.strokeGapLen], ['#123456', 4, 'dashed', '', 0, 0]);
      assert.equal(readBlockTokenBindings(row.links).strokeDash?.adapter, 'border.style');
    }
    h.remount(); h.property('__border'); assert.match(h.root.textContent!, /Linked: \{edge\}/);
    h.root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick();
    assert.ok(![...h.root.querySelectorAll<HTMLOptionElement>('[data-token-options] option')].some(option => option.value === 'unsupported'));
  } finally { h.destroy(); }
});
test('a local dash override exposes whole-border restore and preserves other links', async () => {
  const h = harness([{ id: 'a', kind: 'path' }, { id: 'b', kind: 'path' }]);
  try {
    h.property('__border'); await h.choose();
    h.replace(resolveBlockTokenBindings(h.rows().map((row, index) => index ? row : { ...row, strokeDashArray: '9 4', strokeDashLen: 9 }), 'links', fields, set) as Box[]);
    h.remount(); h.property('__border'); assert.match(h.root.textContent!, /Mixed values/);
    assert.ok(h.root.querySelector('[data-token-restore]'));
    h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick(); assert.equal(h.commits(), 2);
    assert.ok(h.rows().every(row => row.strokeDashArray === '' && row.strokeDashLen === 0 && !readBlockTokenBindings(row.links).strokeDash?.custom));
    h.remount(); h.property('__border'); h.root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click(); await tick();
    assert.equal(h.commits(), 3); assert.ok(h.rows().every(row => row.strokeW === 4 && Object.values(readBlockTokenBindings(row.links)).every(link => link.custom)));
  } finally { h.destroy(); }
});
test('individual stroke-style restore also clears the more specific local dash settings', async () => {
  const h = harness([{ id: 'a', kind: 'path' }]);
  try {
    h.property('__border'); await h.choose();
    h.replace(resolveBlockTokenBindings([{ ...h.rows()[0], strokeDashArray: '8 2', strokeGapLen: 2 }], 'links', fields, set) as Box[]);
    h.remount(); h.property('strokeDash');
    h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.deepEqual([h.rows()[0]!.strokeDash, h.rows()[0]!.strokeDashArray, h.rows()[0]!.strokeGapLen], ['dashed', '', 0]);
    assert.equal(readBlockTokenBindings(h.rows()[0]!.links).stroke?.ref, '{edge}');
  } finally { h.destroy(); }
});
test('changing a dash value during async resolution refuses the entire pending border action', async () => {
  let calls = 0, finish: (value: typeof set) => void = () => {};
  const pending = new Promise<typeof set>(resolve => { finish = resolve; });
  const h = harness([{ id: 'a', kind: 'path', strokeDashArray: '7 3' }], { tokens: { get: () => ++calls === 3 ? pending : Promise.resolve(set) } } as HostV1);
  try {
    h.property('__border'); await h.choose(); assert.equal(calls, 3); assert.equal(h.commits(), 0);
    h.replace([{ ...h.rows()[0], strokeDashArray: '9 4' }]); finish(set); await tick();
    assert.equal(h.commits(), 0); assert.equal(h.rows()[0]!.strokeDashArray, '9 4'); assert.match(h.root.textContent!, /These layer values changed/);
  } finally { h.destroy(); }
});
test('changing the selected layer disposes a pending border action before it can commit', async () => {
  let calls = 0, finish: (value: typeof set) => void = () => {};
  const pending = new Promise<typeof set>(resolve => { finish = resolve; });
  const h = harness([{ id: 'a', kind: 'path', strokeDashArray: '7 3' }, { id: 'b', kind: 'box', stroke: '#ffffff' }], { tokens: { get: () => ++calls === 3 ? pending : Promise.resolve(set) } } as HostV1);
  try {
    h.remount(['a']); h.property('__border'); await h.choose(); assert.equal(calls, 3);
    h.remount(['b']); finish(set); await tick();
    assert.equal(h.commits(), 0); assert.equal(h.rows()[0]!.strokeDashArray, '7 3'); assert.equal(h.rows()[1]!.stroke, '#ffffff');
  } finally { h.destroy(); }
});
