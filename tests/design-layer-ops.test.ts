// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/design-layer-ops.ts: the Design edits by stable id that the MCP server
 * and the live editor bridge share (plans/289 D1). The MCP behaviour is covered in
 * services/mcp/test/design-agent.test.ts; this holds the module's own contract.
 *
 * Run with: node --test tests/design-layer-ops.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLayerOperations, applyLayerPatches } from '../engine/src/design-layer-ops.ts';

const rows = () => [
  { id: 'board', kind: 'frame', order: 0 },
  { id: 'title', kind: 'text', frame: 'board', z: 0, text: 'Hello' },
  { id: 'logo', kind: 'image', frame: 'board', z: 1 },
];

test('rows in, new rows out: the caller\'s rows are never changed', () => {
  const before = rows();
  const after = applyLayerPatches(before, [{ id: 'title', set: { text: 'Hi' } }]);
  assert.equal((before[1] as { text: string }).text, 'Hello');
  assert.equal((after[1] as { text: string }).text, 'Hi');
});

test('operations run in order: an added layer can be addressed by the next operation', () => {
  const out = applyLayerOperations(rows(), [
    { op: 'add', layer: { id: 'badge', kind: 'box', frame: 'board' }, afterId: 'title' },
    { op: 'reorder', id: 'badge', beforeId: 'title' },
  ], (id, fallback) => (id === 'w' ? 99 : fallback)) as Array<{ id: string; z?: number; w?: number }>;
  const z = (id: string) => out.find((r) => r.id === id)!.z;
  assert.ok(z('badge')! < z('title')!);
  assert.equal(out.find((r) => r.id === 'badge')!.w, 99, 'a missing field takes the manifest default');
});

test('mistakes are refused with the JSON path at fault', () => {
  assert.throws(() => applyLayerOperations(rows(), [{ op: 'remove', id: 'board' }]), /\/layerOperations\/0\/cascade/);
  assert.throws(() => applyLayerOperations(rows(), [{ op: 'add', layer: { id: 'title' } }]), /already exists/);
  assert.throws(() => applyLayerPatches(rows(), [{ id: 'title', set: { id: 'x' } }]), /cannot be changed/);
  assert.throws(() => applyLayerPatches(rows(), [{ id: 'ghost', set: {} }]), /does not exist/);
  assert.throws(() => applyLayerOperations(rows(), { op: 'add' }), /must be an array/);
});
const nestedRows = (): Record<string,unknown>[] => [
  {id:'board',kind:'frame',pageId:'p1'},
  {id:'group',kind:'group',frame:'board',pageId:'p1'},
  {id:'inner',kind:'group',group:'group',pageId:'p1'},
  {id:'a',kind:'box',group:'inner',pageId:'p1',bindEnd:'b'},
  {id:'b',kind:'box',group:'group',pageId:'p1',clip:'a'},
  {id:'other',kind:'group',pageId:'p2'},
];
const hierarchyPages = [{id:'p1',name:'First'},{id:'p2',name:'Second'}];
test('agent duplicates a nested group with remapped ownership and internal binding references', () => {
  const out=applyLayerOperations(nestedRows(),[{op:'duplicate',id:'group',newId:'copy',childIds:{inner:'copy-inner',a:'copy-a',b:'copy-b'}}],undefined,{pages:hierarchyPages}) as Record<string,unknown>[];
  assert.equal(out.find(row=>row.id==='copy-inner')?.group,'copy');
  assert.equal(out.find(row=>row.id==='copy-a')?.group,'copy-inner');
  assert.equal(out.find(row=>row.id==='copy-a')?.bindEnd,'copy-b');
  assert.equal(out.find(row=>row.id==='copy-b')?.clip,'copy-a');
  assert.equal(out.find(row=>row.id==='copy')?.frame,'board');
  assert.throws(()=>applyLayerOperations(nestedRows(),[{op:'duplicate',id:'group',newId:'copy'}]),/childIds/);
});
test('agent artboard cascade includes group-owned descendants with an empty artboard pointer', () => {
  assert.throws(()=>applyLayerOperations(nestedRows(),[{op:'remove',id:'board'}]),/cascade/);
  const out=applyLayerOperations(nestedRows(),[{op:'remove',id:'board',cascade:true}],undefined,{pages:hierarchyPages}) as Record<string,unknown>[];
  assert.deepEqual(out.map(row=>row.id),['other']);
});
test('agent reparent carries page membership and refuses cyclic or cross-domain ownership', () => {
  const out=applyLayerOperations(nestedRows(),[{op:'reparent',id:'group',parentId:'other'}],undefined,{pages:hierarchyPages}) as Record<string,unknown>[];
  assert.equal(out.find(row=>row.id==='group')?.group,'other');
  for(const id of ['group','inner','a','b']) assert.equal(out.find(row=>row.id===id)?.pageId,'p2');
  assert.throws(()=>applyLayerOperations(nestedRows(),[{op:'reparent',id:'group',parentId:'inner'}],undefined,{pages:hierarchyPages}),/own subtree/);
  assert.throws(()=>applyLayerOperations(nestedRows(),[{op:'reorder',id:'inner',afterId:'other'}],undefined,{pages:hierarchyPages}),/sibling/);
});
test('agent sibling reorder moves the entire group subtree together', () => {
  const source: Record<string,unknown>[]=nestedRows().map(row=>({...row,pageId:'p1'})); source[5]!.frame='board';
  const out=applyLayerOperations(source,[{op:'reorder',id:'group',afterId:'other'}]) as Record<string,unknown>[];
  assert.deepEqual(out.map(row=>row.id),['board','other','group','inner','a','b']);
});
test('agent duplication refuses incomplete document metadata and group patches refuse detached geometry', () => {
  for(const patch of [{layout:'grid'},{textStory:'story'}]) assert.throws(()=>applyLayerOperations([{id:'g',kind:'group'},{id:'child',kind:'box',group:'g',...patch}],[{op:'duplicate',id:'g',newId:'copy',childIds:{child:'copy-child'}}]),/document metadata/);
  assert.throws(()=>applyLayerPatches(nestedRows(),[{id:'group',set:{x:500}}],{pages:hierarchyPages}),/canvas transform/);
  assert.throws(()=>applyLayerPatches(nestedRows(),[{id:'group',set:{group:'inner'}}],{pages:hierarchyPages}),/cycle/);
});
