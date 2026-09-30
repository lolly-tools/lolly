// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { parseUrlState } from '@lolly/engine';
import { copyWorkspaceParams, inputParamIds } from './tool-url-state.ts';
import { encodeAddressModelParam, encodeModelParam } from './url-budget.ts';

const item = (spec: Partial<InputModelItem>): InputModelItem => ({ id: 'value', type: 'text', value: '', isDirty: false, ...spec }) as InputModelItem;
const encode = (model: InputModelItem[], share = false): string => model.flatMap(share ? encodeModelParam : encodeAddressModelParam).filter(part => part.status === 'kept').map(part => part.emit).join('&');

test('incoming aliases, vector fields, token companions and dimension aliases track permanent ids', () => {
  const model = [item({ id: 'boxes', urlKey: 'bx', type: 'blocks' }), item({ id: 'position', urlKey: 'p', type: 'vector' }), item({ id: 'title', urlKey: 't' })];
  const ids = inputParamIds('bx=shape&p.x=70&_restore.t=%7Blabel%7D&width=500&height=400', model);
  for (const id of ['boxes', 'position', 'title', 'w', 'h']) assert.ok(ids.has(id), id);
});

test('address and content links reconstruct false, cleared defaults, empty collections and long values', () => {
  const model = [
    item({ id: 'join', type: 'boolean', default: true, value: false }),
    item({ id: 'data', default: 'Demo data', value: '' }),
    item({ id: 'url', type: 'url', value: `https://example.com/${'a'.repeat(200)}` }),
    item({ id: 'boxes', urlKey: 'bx', type: 'blocks', default: [{ label: 'Demo' }], fields: [{ id: 'label', type: 'text' }], value: [] }),
    item({ id: 'grid', type: 'table', default: { columns: ['Demo'], rows: [['1']] }, value: { columns: [], rows: [] } }),
    item({ id: 'pos', urlKey: 'p', type: 'vector', fields: [{ id: 'x', type: 'number', default: 0 }], value: { x: 70 } }),
  ];
  for (const share of [false, true]) {
    const parsed = parseUrlState(encode(model, share), { inputs: model });
    for (const input of model) assert.deepEqual(parsed.values[input.id], input.value, input.id);
  }
});

test('workspace references stay local and files report incomplete content links', () => {
  const upload = item({ id: 'photo', type: 'asset', value: { source: 'user', id: 'user/photo', url: 'blob:local' } });
  assert.equal(new URLSearchParams(encode([upload])).get('photo'), 'user/photo');
  assert.equal(encode([upload], true), '');
  assert.equal(encodeModelParam(upload)[0]?.status, 'dropped-asset');
  const file = item({ type: 'file', value: { __file: true, name: 'local.pdf', bytes: new Uint8Array([1]) } as InputModelItem['value'] });
  assert.equal(encodeModelParam(file)[0]?.status, 'dropped-asset');
});

test('blocks preserve local assets in the address and report their absence from Share', () => {
  const upload = { source: 'user', id: 'user/photo', url: 'blob:local' };
  for (const fields of [[], [{ id: 'photo', type: 'asset' as const }]]) {
    const blocks = item({ id: 'boxes', type: 'blocks', fields, value: [{ photo: upload }] });
    assert.match(decodeURIComponent(encode([blocks])), /user(?:%2F|\/)photo/);
    assert.doesNotMatch(decodeURIComponent(encode([blocks], true)), /user(?:%2F|\/)photo/);
    assert.ok(encodeModelParam(blocks).some(part => part.status === 'dropped-asset'));
  }
});

test('a delayed content write takes current workspace state, including closed panels', () => {
  const pending = new URLSearchParams('z=content&_sel=old&options=&_view=old');
  const current = new URLSearchParams('_ui=new&_view=latest&present=&s=frame-2.1&kiosk=&slot=local');
  copyWorkspaceParams(pending, current);
  assert.equal(pending.toString(), 'z=content&_ui=new&_view=latest&present=&s=frame-2.1&kiosk=&slot=local');
});
