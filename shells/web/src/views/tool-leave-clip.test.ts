// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-leave.ts recordedClipBytes: when the Unsaved changes dialog says
 * "Includes a {size} video clip". Plan 302 gave every upload its stored length
 * in meta.bytes, so the line must key on a recorded take, never on bytes alone.
 *
 * Run directly:  node --test shells/web/src/views/tool-leave-clip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordedClipBytes } from './tool-leave.ts';

const take = { source: 'user', id: 'user/recording/1800000000000.webm', type: 'video', format: 'webm', url: 'blob:x', meta: { name: 'Recording.webm', bytes: 4_200_000 } };

test('a recorded video take gives its stored size', () => {
  assert.equal(recordedClipBytes([take]), 4_200_000);
  assert.equal(recordedClipBytes(['Title', 12, null, take]), 4_200_000, 'other inputs are passed over');
});

test('the in-memory take the record control keeps when the store refuses one counts too', () => {
  const fallback = { source: 'user', id: 'recording.mp4', type: 'video', format: 'mp4', url: 'blob:y', meta: { bytes: 900_000 } };
  assert.equal(recordedClipBytes([fallback]), 900_000);
});

test('an upload with a stored size is not a video clip', () => {
  const photo = { source: 'user', id: 'user/upload/1800000000000-photo.png', type: 'raster', format: 'png', url: 'blob:z', meta: { bytes: 3_000_000 } };
  const film = { source: 'user', id: 'user/upload/1800000000000-film.mp4', type: 'video', format: 'mp4', url: 'blob:w', meta: { bytes: 80_000_000 } };
  assert.equal(recordedClipBytes([photo]), null);
  assert.equal(recordedClipBytes([film]), null, 'an uploaded video is not a take either');
});

test('a screenshot or a voiceover in the take namespace is not a video clip', () => {
  const still = { ...take, id: 'user/recording/1800000000001.png', type: 'raster', format: 'png' };
  const voice = { ...take, id: 'user/recording/1800000000002.webm', type: 'audio' };
  assert.equal(recordedClipBytes([still, voice]), null);
});

test('a take with no usable size says nothing', () => {
  for (const bytes of [undefined, 0, -1, Number.NaN, '4200000']) {
    assert.equal(recordedClipBytes([{ ...take, meta: { bytes } }]), null, String(bytes));
  }
  assert.equal(recordedClipBytes([{ ...take, meta: null }]), null);
  assert.equal(recordedClipBytes([]), null);
});
