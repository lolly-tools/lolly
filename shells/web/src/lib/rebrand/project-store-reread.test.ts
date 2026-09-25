// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 275 decision 24: a stored pptx source read before the reader resolved
 * paragraph formatting is read again on open when its bytes were retained, and
 * reported as not read when they were not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ENGINE_VERSION } from '@lolly/engine';

import { FORMATTING_NOT_READ_MESSAGE, sourceReadFreshness } from './project-store.ts';

const source = (kind: 'pptx' | 'pdf', version: string) => ({
  source: { kind, hash: 'sha256:x', lineageId: 'l', instanceId: 'i', pageCount: 1 },
  reader: { name: kind === 'pptx' ? 'pptx-read' : 'pdf-read', version },
});

test('a source read by this reader or a later one is current', () => {
  assert.deepEqual(sourceReadFreshness({ source: source('pptx', '1.223.0').source }, source('pptx', '1.223.0'), '1.223.0'), { state: 'current' });
  assert.deepEqual(sourceReadFreshness({ source: source('pptx', '2.0.0').source }, source('pptx', '2.0.0'), '1.223.0'), { state: 'current' });
  assert.deepEqual(sourceReadFreshness({ source: source('pdf', '1.100.0').source }, source('pdf', '1.100.0'), '1.223.0'), { state: 'current' }, 'a pdf is not read by this reader');
});

test('an older read is read again from the retained bytes, else reported as not read', () => {
  const old = source('pptx', '1.222.0+rebuild');
  assert.deepEqual(sourceReadFreshness({ source: { ...old.source, bytesAssetRef: 'user/abc' } }, old, '1.223.0'), { state: 're-read', assetRef: 'user/abc' });
  assert.deepEqual(sourceReadFreshness({ source: old.source }, old, '1.223.0'), { state: 'not-read', message: FORMATTING_NOT_READ_MESSAGE });
  assert.deepEqual(sourceReadFreshness({ source: old.source }, source('pptx', 'test'), '1.223.0').state, 'not-read', 'a version that is not one reads as older');
});

test('a source this engine reads is current under the default floor', () => {
  // Sources are stamped with ENGINE_VERSION, so a floor past it would re-read every new project on every open.
  const fresh = source('pptx', ENGINE_VERSION);
  assert.deepEqual(sourceReadFreshness({ source: { ...fresh.source, bytesAssetRef: 'user/abc' } }, fresh), { state: 'current' });
});
