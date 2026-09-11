// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSupport } from './tool-support.ts';

test('file-transform support is catalog-derived and never coupled to a tool id', () => {
  assert.equal(toolSupport({ id: 'future-utility', name: 'Future', fileTransform: true }), 'needs-file');
  assert.equal(toolSupport({ id: 'pages', name: 'Pages' }), 'ok');
  assert.equal(toolSupport({ id: 'camera-file', name: 'Camera', capabilities: ['camera'] }), 'browser-only');
});
