// SPDX-License-Identifier: MPL-2.0
/**
 * device-picker grouping (plans/162). The DOM/modal + getUserMedia paths need a
 * browser; the pure grouping/label-fallback/de-dupe is tested here.
 *
 * Run: node --test shells/web/src/components/device-picker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupDevices } from './device-picker.ts';

test('splits cameras and mics, keeps real labels', () => {
  const g = groupDevices([
    { deviceId: 'c1', kind: 'videoinput', label: 'FaceTime HD' },
    { deviceId: 'm1', kind: 'audioinput', label: 'MacBook Mic' },
    { deviceId: 'c2', kind: 'videoinput', label: 'USB Webcam' },
    { deviceId: 'x1', kind: 'audiooutput', label: 'Speakers' }, // ignored
  ]);
  assert.deepEqual(g.cameras.map((c) => c.label), ['FaceTime HD', 'USB Webcam']);
  assert.deepEqual(g.mics.map((m) => m.label), ['MacBook Mic']);
  assert.equal(g.cameras[0]!.kind, 'videoinput');
});

test('falls back to generic names when labels are blank (no grant yet)', () => {
  const g = groupDevices([
    { deviceId: 'c1', kind: 'videoinput', label: '' },
    { deviceId: 'c2', kind: 'videoinput' },
    { deviceId: 'm1', kind: 'audioinput', label: '   ' },
  ]);
  assert.deepEqual(g.cameras.map((c) => c.label), ['Camera 1', 'Camera 2']);
  assert.deepEqual(g.mics.map((m) => m.label), ['Microphone 1']);
});

test('de-dupes by deviceId and drops blank-id placeholder entries', () => {
  const g = groupDevices([
    { deviceId: '', kind: 'videoinput', label: '' },        // pre-grant placeholder
    { deviceId: 'c1', kind: 'videoinput', label: 'Cam' },
    { deviceId: 'c1', kind: 'videoinput', label: 'Cam dup' }, // duplicate id
  ]);
  assert.equal(g.cameras.length, 1);
  assert.equal(g.cameras[0]!.deviceId, 'c1');
});
