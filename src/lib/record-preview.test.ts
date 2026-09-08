// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimRecordPreview, subscribeRecordPreview } from './record-preview.ts';

const stream = (id: string): MediaStream => ({ id }) as MediaStream;

test('late permission from an older request cannot replace or end the newer preview', () => {
  const values: Array<MediaStream | null> = [];
  const off = subscribeRecordPreview(value => values.push(value));
  const older = claimRecordPreview(), newer = claimRecordPreview();
  const latest = stream('newer');
  newer(latest); older(stream('older')); older(null);
  assert.deepEqual(values, [null, latest]);
  newer(null); assert.equal(values.at(-1), null); off();
});

test('finalisation of a previous take cannot stop the current preview', () => {
  const older = claimRecordPreview(); older(stream('older'));
  const newer = claimRecordPreview(), latest = stream('newer'); newer(latest);
  const values: Array<MediaStream | null> = [];
  const off = subscribeRecordPreview(value => values.push(value));
  older(null); assert.deepEqual(values, [latest]);
  newer(null); newer(null);
  assert.deepEqual(values, [latest, null], 'releasing twice emits one end'); off();
});

test('an active preview can still end while another request awaits permission', () => {
  const older = claimRecordPreview(); older(stream('older'));
  claimRecordPreview();
  older(null);
  const values: Array<MediaStream | null> = [];
  const off = subscribeRecordPreview(value => values.push(value));
  assert.deepEqual(values, [null]); off();
});
