// SPDX-License-Identifier: MPL-2.0
/** views/tool-session-snapshot.ts - what a template keeps from a saved document (plans/226). */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATE_DROPPED_KEYS, templateValuesFromSnapshot } from './tool-session-snapshot.ts';

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
