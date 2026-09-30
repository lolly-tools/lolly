// SPDX-License-Identifier: MPL-2.0
/** views/tool-session-snapshot.ts - what a template keeps from a saved document (plans/226). */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATE_DROPPED_KEYS, awaitsEmojiPins, carriedEmojiPins, snapshotSession, templateValuesFromSnapshot } from './tool-session-snapshot.ts';
import { emojiParams } from '../../../../engine/src/emoji-style.ts';
import { buildInputModel, tokenRestoreRefsOf } from '../../../../engine/src/inputs.ts';

test('a saved custom value carries its restore link into a reopened document and template', () => {
  const spec = { inputs: [{ id: 'gap', type: 'number' as const, default: 10 }] };
  const model = buildInputModel(spec, { initial: { gap: 17, __tokenLinks: { gap: '{rhythm.gap}' } } });
  const snap = snapshotSession(null, { id: 'example', version: '1.0.0' } as never, { getModel: () => model } as never, {}, () => '', () => '');
  assert.equal(snap.gap, 17);
  assert.deepEqual(snap.__tokenLinks, { gap: '{rhythm.gap}' });
  const template = templateValuesFromSnapshot(snap, spec);
  assert.deepEqual(tokenRestoreRefsOf(buildInputModel(spec, { initial: template as never })), { gap: '{rhythm.gap}' });
});

const manifest = { inputs: [{ id: 'url', type: 'text' }, { id: 'photo', type: 'asset' }, { id: 'source', type: 'file' }] };

test('templateValuesFromSnapshot: drops document identity + file inputs, keeps export settings and refs', () => {
  const snap = {
    url: 'https://suse.com', photo: { id: 'user/img/1' }, source: { name: 'a.pdf', bytes: 3 },
    __label: 'Q3 poster', __toolId: 'qr-code', __toolVersion: '1.2.0', __export_filename: 'Q3 poster',
    __export_format: 'svg', __export_width: '210', __export_height: '297', __export_unit: 'mm', __export_dpi: '300',
    __design_state: { zoom: 1 }, gone: undefined,
  };
  assert.deepEqual(templateValuesFromSnapshot(snap, manifest), {
    url: 'https://suse.com', photo: { id: 'user/img/1' },
    __export_format: 'svg', __export_width: '210', __export_height: '297', __export_unit: 'mm', __export_dpi: '300',
    __design_state: { zoom: 1 },
  });
});

test('templateValuesFromSnapshot: tolerates a manifest with no inputs', () => {
  assert.deepEqual(templateValuesFromSnapshot({ a: 1, __label: 'x' }, {}), { a: 1 });
  assert.deepEqual([...TEMPLATE_DROPPED_KEYS].sort(), ['__export_filename', '__label', '__toolId', '__toolVersion']);
});

// ── Emoji artwork pins while the Emoji section is still loading (plan 277 P4, phase 0 finding 1)

const style = {
  schemaVersion: 1 as const,
  primary: { id: 'community/emoji/twemoji', pin: { version: '17.0.3' }, checksum: 'sha256:abc' },
  fallbacks: [],
  metricsPolicy: 'inline-em-v1' as const,
  treatment: { mode: 'original' as const, strengthBps: 0 as const },
};
const pin = { source: 'user', id: 'user/emoji/abc', type: 'data', format: 'json', pin: { version: 'abc', format: 'json' } };

test('carriedEmojiPins: a reopened record keeps its pins until the runtime has resolved its own for the same style', () => {
  const stamp = emojiParams(style);
  // History stores canonical JSON, so the stamp comes back with its keys sorted.
  const opened = { __emoji: { emojistyle: stamp.emojistyle, emojifx: stamp.emojifx, emoji: stamp.emoji }, __emojiAssets: [pin] };
  assert.deepEqual(carriedEmojiPins({ style, assets: [] }, opened), { __emojiAssets: [pin] });
  assert.deepEqual(carriedEmojiPins({ style, assets: [pin] }, opened), {}, 'the runtime has its own pins');
  assert.deepEqual(carriedEmojiPins({ style: null, assets: [] }, opened), {}, 'no set chosen');
  assert.deepEqual(carriedEmojiPins({ style: { ...style, primary: { ...style.primary, pin: { version: '18.0.0' } } }, assets: [] }, opened), {}, 'another style names other artwork');
  assert.deepEqual(carriedEmojiPins({ style, assets: [] }, { ...opened, __emojiAssets: [] }), {}, 'nothing stored to carry');
  assert.deepEqual(carriedEmojiPins(undefined, opened), {});
});

test('awaitsEmojiPins: a chosen set with no pins yet, and nothing else', () => {
  assert.equal(awaitsEmojiPins({ __emoji: { emoji: 'community/emoji/twemoji@17.0.3', emojifx: 'original' }, __emojiAssets: [] }), true);
  assert.equal(awaitsEmojiPins({ __emoji: { emoji: 'community/emoji/twemoji@17.0.3', emojifx: 'original' }, __emojiAssets: [pin] }), false);
  assert.equal(awaitsEmojiPins({ __emoji: { emoji: 'none', emojifx: '' }, __emojiAssets: [] }), false);
  assert.equal(awaitsEmojiPins({}), false);
});

test('snapshotSession: sessionMeta can carry pins and name a document with no export name', () => {
  const runtime = { getModel: () => [{ id: 'body', value: 'Hello' }], emoji: { style, assets: [] }, outputLicence: () => null };
  const snap = snapshotSession(null, { id: 'text-helper', version: '1.0.0' } as never, runtime as never,
    { sessionMeta: () => ({ __emojiAssets: [pin], __label: 'notes.md' }) }, () => '', () => '');
  assert.deepEqual(snap.__emojiAssets, [pin]);
  assert.equal(snap.__label, 'notes.md');
  assert.equal(snap.body, 'Hello');
  const unnamed = snapshotSession(null, { id: 'qr-code', version: '1.0.0' } as never, runtime as never, {}, () => '', () => '');
  assert.equal(unnamed.__label, undefined, 'no name leaves the existing auto-label alone');
  assert.deepEqual(unnamed.__emojiAssets, []);
});
