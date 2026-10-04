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
