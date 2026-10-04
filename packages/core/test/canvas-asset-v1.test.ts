// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCanvasAsset, decodeCanvasAsset } from '../src/canvas-asset-v1.ts';

test('canvas assets carry immutable project identity without URLs or metadata', () => {
  const encoded = encodeCanvasAsset({ id: 'user/team/file_1', source: 'user', type: 'raster', format: 'png',
    pin: { version: 'sha256-example', format: 'png' }, url: 'blob:private', original: 'https://private', meta: { token: 'private' } });
  assert.ok(encoded); assert.ok(!encoded.includes('private'));
  assert.equal(decodeCanvasAsset(encoded)?.pin?.version, 'sha256-example');
  for (const value of [
    { id: 'user/upload/local', source: 'user', type: 'raster', format: 'png' },
    { id: 'https://attacker.test/a', source: 'library', type: 'raster', format: 'png' },
    { id: 'user/team/file', source: 'user', type: 'raster', format: 'png' },
    { id: 'library/a', source: 'library', type: 'raster', format: 'png', width: Infinity },
  ]) assert.equal(encodeCanvasAsset(value), null);
  assert.equal(decodeCanvasAsset('lolly-asset-v1:{broken'), null);
  assert.equal(decodeCanvasAsset('ordinary text'), null);
});
