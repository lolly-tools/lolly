// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimCoversOp, claimsOverlap, readCanvasPreview, readClaimTarget } from '../src/canvas-interaction-v1.ts';
import { sanitizePresenceState } from '../src/collab-presence-v1.ts';

test('claims are atomic bounded targets, distinct for text and geometry', () => {
  const move = readClaimTarget({ kind: 'transform', collection: 'boxes', ids: ['a', 'b'] })!;
  assert.ok(move);
  assert.equal(readClaimTarget({ ...move, ids: ['a', 'a'] }), null);
  assert.equal(readClaimTarget({ ...move, ids: Array(201).fill('a') }), null);
  assert.equal(readClaimTarget({ ...move, collection: '__proto__' }), null);
  assert.equal(claimsOverlap(move, { ...move, ids: ['b'] }), true);
  assert.equal(claimsOverlap(move, { ...move, collection: 'other' }), false);
  const text = { ...move, kind: 'text' as const, field: 'text' };
  assert.equal(claimsOverlap(move, text), false);
  assert.equal(claimsOverlap({ ...text, param: 'stories', ids: ['a'] }, { ...text, param: 'stories', ids: ['b'] }), true);
  const origin = { client: 'peer', clock: 1 };
  assert.equal(claimCoversOp(move, { k: 'geom', col: 'boxes', id: 'a', fields: { x: 2 }, origin }), true);
  assert.equal(claimCoversOp(move, { k: 'field', col: 'boxes', id: 'a', field: 'color', value: 'red', origin }), false);
  assert.equal(claimCoversOp(text, { k: 'field', col: 'boxes', id: 'a', field: 'text', value: 'hello', origin }), true);
});

test('previews preserve document coordinates without allowing unbounded or hostile geometry', () => {
  const preview = { claimId: 'gesture', collection: 'boxes', kind: 'move', phase: 'active',
    objects: [{ id: 'a', x: -100, y: 200, w: 40, h: 80, rot: 30 }] };
  assert.deepEqual(readCanvasPreview(preview), preview);
  assert.deepEqual(sanitizePresenceState({ preview }).preview, preview);
  for (const value of [Infinity, NaN, 1e7]) assert.equal(readCanvasPreview({ ...preview, objects: [{ ...preview.objects[0], x: value }] }), null);
  assert.equal(readCanvasPreview({ ...preview, objects: [{ ...preview.objects[0], w: 0 }] }), null);
  assert.equal(readCanvasPreview({ ...preview, objects: [preview.objects[0], preview.objects[0]] }), null);
  assert.equal(sanitizePresenceState({ preview: { ...preview, objects: [{}] } }).preview, undefined);
});
