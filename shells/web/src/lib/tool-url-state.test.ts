// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { parseUrlState } from '@lolly/engine';
import { addressPointer, copyWorkspaceParams, deviceLinkParams, inputParamIds, packableContent, pointerParams } from './tool-url-state.ts';
import { LINK_CONTENT_MAX } from './url-budget.ts';
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

/** A Design address as session.ts builds it: content, `_themes`, workspace, slot and result context. */
const designAddress = (): URLSearchParams => new URLSearchParams({
  bx: 'shape,box,100,100,180,120', textDocument: '{"stories":[]}', format: 'png', w: '1920', h: '1080',
  _themes: '{"":"dark"}', _view: '{"scale":2,"x":10,"y":20}', _sel: 'shape', slot: 'design:abc', designv: '3',
});

test('a document past the pack limit switches the address to the pointer form', () => {
  const params = designAddress();
  const content = packableContent(params).toString();
  assert.ok(content.length < LINK_CONTENT_MAX);
  const opts = { maxContent: LINK_CONTENT_MAX, slot: 'design:abc' };
  assert.equal(addressPointer(params, { ...opts, contentLength: content.length }), null, 'a small document keeps its content');
  assert.equal(addressPointer(params, { ...opts, contentLength: LINK_CONTENT_MAX }), null, 'exactly at the limit still packs');
  const pointer = new URLSearchParams(addressPointer(params, { ...opts, contentLength: LINK_CONTENT_MAX + 1 })!);
  assert.deepEqual(Object.fromEntries(pointer), {
    _view: '{"scale":2,"x":10,"y":20}', _sel: 'shape', slot: 'design:abc', _themes: '{"":"dark"}', designv: '3',
  }, 'workspace, the saved copy and the keys the shell reads from the address; no content, no export settings');
});

test('a refused pack is remembered, and without a saved copy the document stays in the address', () => {
  const params = designAddress();
  const opts = { maxContent: LINK_CONTENT_MAX, slot: 'design:abc' };
  assert.ok(addressPointer(params, { ...opts, contentLength: 70_000, refusedAt: 70_000 }), 'refused at this length: the pointer');
  assert.ok(addressPointer(params, { ...opts, contentLength: 90_000, refusedAt: 70_000 }), 'and at anything longer');
  assert.equal(addressPointer(params, { ...opts, contentLength: 60_000, refusedAt: 70_000 }), null, 'a shorter document packs again');
  assert.equal(addressPointer(params, { ...opts, contentLength: LINK_CONTENT_MAX + 1, slot: null }), null, 'nothing else would restore it on a reload');
  assert.equal(pointerParams(new URLSearchParams('bx=a&_view=v')).toString(), '_view=v');
});

test('the device link reopens the saved copy and nothing else', () => {
  const link = deviceLinkParams(designAddress())!;
  assert.deepEqual(Object.fromEntries(link), { slot: 'design:abc', _themes: '{"":"dark"}', designv: '3' });
  assert.equal(deviceLinkParams(new URLSearchParams('bx=a&_view=v')), null, 'no saved copy, no device link');
});
