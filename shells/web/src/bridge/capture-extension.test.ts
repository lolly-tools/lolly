// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createExtensionCaptureAPI } from './capture-extension.ts';

test('the extension refuses isolated capture before reading its browser relay', async () => {
  await assert.rejects(createExtensionCaptureAPI().page({
    url: 'https://capture.example.test/', width: 600, isolation: 'isolated-public',
  }), /does not provide isolated public/);
});
