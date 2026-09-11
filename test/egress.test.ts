// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertBrowserRequestAllowed,
  browserAllowedOrigins,
  checkedBase,
  isPublicAddress,
} from '../src/egress.ts';

test('browser egress address policy rejects local, private, metadata and documentation ranges', () => {
  for (const address of [
    '127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '172.16.1.2',
    '192.168.1.2', '192.0.2.1', '198.51.100.2', '203.0.113.4', '::1', 'fc00::1',
    'fe80::1', '2001:db8::1',
  ]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('1.1.1.1'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('browser base and extra origins are exact, HTTPS, and credential free', () => {
  assert.equal(checkedBase('https://render.example.test/app').origin, 'https://render.example.test');
  assert.equal(checkedBase('http://127.0.0.1:8123').origin, 'http://127.0.0.1:8123');
  assert.throws(() => checkedBase('http://render.example.test'), /HTTPS/);
  assert.throws(() => checkedBase('https://user:pw@render.example.test'), /credentials/);
  const allowed = browserAllowedOrigins('https://render.example.test', {
    LOLLY_BROWSER_ALLOWED_ORIGINS: 'https://assets.example.test',
  });
  assert.deepEqual([...allowed], ['https://render.example.test', 'https://assets.example.test']);
  assert.throws(
    () => browserAllowedOrigins('https://render.example.test', { LOLLY_BROWSER_ALLOWED_ORIGINS: 'https://assets.example.test/path' }),
    /origins/,
  );
});

test('browser requests require an allowlisted origin whose complete DNS answer is public', async () => {
  const env = { LOLLY_BROWSER_ALLOWED_ORIGINS: 'https://assets.example.test' };
  const publicDns = async () => ['1.1.1.1', '2606:4700:4700::1111'];
  await assert.doesNotReject(assertBrowserRequestAllowed(
    'https://assets.example.test/image.png', 'https://render.example.test', env, publicDns,
  ));
  await assert.rejects(assertBrowserRequestAllowed(
    'https://off-list.example.test/image.png', 'https://render.example.test', env, publicDns,
  ), /off-list/);
  await assert.rejects(assertBrowserRequestAllowed(
    'https://assets.example.test/image.png', 'https://render.example.test', env,
    async () => ['1.1.1.1', '169.254.169.254'],
  ), /DNS answer/);
  await assert.doesNotReject(assertBrowserRequestAllowed(
    'http://127.0.0.1:8123/app.js', 'http://127.0.0.1:8123', {}, async () => [],
  ));
});

test('hosted MCP cannot acquire model weights even from its allowed local shell', async () => {
  for (const path of ['/models/matte/model.onnx', '/other/model.gguf', '/other/model.safetensors']) {
    await assert.rejects(assertBrowserRequestAllowed(`http://127.0.0.1:8123${path}`, 'http://127.0.0.1:8123', {}, async () => []), /model execution is disabled/);
  }
});
