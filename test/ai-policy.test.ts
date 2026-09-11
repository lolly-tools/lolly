// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { withHost } from '../src/host.ts';

test('MCP headless host omits model APIs while keeping ordinary processing', async () => {
  await withHost({}, async (_dom, host) => {
    assert.equal(host.speech, undefined);
    assert.equal(host.upscale, undefined);
    assert.equal(host.matte, undefined);
    assert.equal(host.ocr, undefined);
    assert.ok(host.text);
    assert.ok(host.audio);
    assert.ok(host.assets);
  });
});
