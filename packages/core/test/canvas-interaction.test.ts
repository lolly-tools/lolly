// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_CLAIM_FIELD_LIMIT, claimCoversOp, claimsOverlap, readCanvasPreview, readClaimTarget,
} from '../src/canvas-interaction-v1.ts';
import { sanitizePresenceState } from '../src/collab-presence-v1.ts';
import { encodeCanvasAsset } from '../src/canvas-asset-v1.ts';

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

test('a transform claim covers the keyframe track Design writes, and any content field it lists', () => {
  const origin = { client: 'peer', clock: 1 };
  const field = (name: string, id = 'a') => ({ k: 'field' as const, col: 'boxes', id, field: name, value: '', origin });
  const move = readClaimTarget({ kind: 'transform', collection: 'boxes', ids: ['a'] })!;
  assert.equal(claimCoversOp(move, field('kf')), true, "Design's kfField is 'kf'");
  assert.equal(claimCoversOp(move, field('keyframes')), true, 'the earlier name stays covered');
  assert.equal(claimCoversOp(move, field('frame')), true);
  assert.equal(claimCoversOp(move, field('track')), false, 'another track field must be listed');
  assert.equal(claimCoversOp(move, field('fontSize')), false, 'content stays unclaimed unless listed');
  const scale = readClaimTarget({ ...move, fields: ['track', 'fontSize', 'strokeW'] })!;
  assert.deepEqual(scale.fields, ['track', 'fontSize', 'strokeW']);
  for (const name of ['track', 'fontSize', 'strokeW', 'kf']) assert.equal(claimCoversOp(scale, field(name)), true, name);
  assert.equal(claimCoversOp(scale, field('fill')), false);
  assert.equal(claimCoversOp(scale, field('fontSize', 'b')), false, 'only the claimed boxes');
  assert.equal(claimCoversOp(scale, { k: 'param', key: 'fontSize', value: 1, origin }), false);
});

test('listed fields are bounded, transform only, and leave a claim without them unchanged', () => {
  const move = { kind: 'transform', collection: 'boxes', ids: ['a'] };
  assert.equal('fields' in readClaimTarget(move)!, false);
  for (const fields of [[], ['x', 'x'], ['__proto__'], ['bad\u0000'], 'fontSize', [1],
    Array.from({ length: CANVAS_CLAIM_FIELD_LIMIT + 1 }, (_, i) => `f${i}`)]) {
    assert.equal(readClaimTarget({ ...move, fields }), null, JSON.stringify(fields).slice(0, 40));
  }
  assert.equal(readClaimTarget({ ...move, fields: Array.from({ length: CANVAS_CLAIM_FIELD_LIMIT }, (_, i) => `f${i}`) })!.fields!.length, CANVAS_CLAIM_FIELD_LIMIT);
  assert.deepEqual(readClaimTarget({ kind: 'text', collection: 'boxes', ids: ['a'], field: 'text', fields: ['fontSize'] }),
    { kind: 'text', collection: 'boxes', ids: ['a'], field: 'text' });
});

test('a transform naming a text field holds it against a text claim on the same box', () => {
  const text = { kind: 'text' as const, collection: 'boxes', ids: ['a'], field: 'text' };
  const move = { kind: 'transform' as const, collection: 'boxes', ids: ['a', 'b'] };
  assert.equal(claimsOverlap(move, text), false);
  assert.equal(claimsOverlap({ ...move, fields: ['fontSize'] }, text), false);
  assert.equal(claimsOverlap({ ...move, fields: ['text'] }, text), true);
  assert.equal(claimsOverlap(text, { ...move, fields: ['text'] }), true, 'in either order');
  assert.equal(claimsOverlap({ ...move, ids: ['b'], fields: ['text'] }, text), false);
  assert.equal(claimsOverlap({ ...move, collection: 'other', fields: ['text'] }, text), false);
  assert.equal(claimsOverlap({ ...move, fields: ['text'] }, { ...text, param: 'stories' }), false, 'a story claim is collection-blind');
});

test('headshots keep only bounded portable workspace images, without allowing external URLs or inline bytes', () => {
  const image = encodeCanvasAsset({ id: 'user/team/headshot', source: 'user', type: 'raster', format: 'png', pin: { version: 'immutable' } })!;
  assert.equal(sanitizePresenceState({ headshot: image }).headshot, image);
  for (const value of ['https://tracker.example/photo.png', 'data:image/png;base64,aGVsbG8=', 'x'.repeat(513), encodeCanvasAsset({ id: 'library/audio', source: 'library', type: 'audio', format: 'mp3' })]) {
    assert.equal(sanitizePresenceState({ headshot: value }).headshot, undefined);
  }
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
  const scale = { ...preview, kind: 'scale' };
  assert.deepEqual(readCanvasPreview(scale), scale, 'a Scale is its own preview kind');
  assert.deepEqual(sanitizePresenceState({ preview: scale }).preview, scale);
  assert.equal(readCanvasPreview({ ...preview, kind: 'skew' }), null);
});
