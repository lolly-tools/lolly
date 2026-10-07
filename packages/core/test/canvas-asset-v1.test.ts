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

test('a placed tool crosses the lane as its canonical embed link, and nothing else does as a URL', () => {
  const link = 'https://lolly.tools/tool/pose-geeko.svg?pose=curious&motion=alive&loop=8&w=800&h=800';
  const encoded = encodeCanvasAsset({ id: link, source: 'remote', type: 'vector', format: 'svg',
    url: 'data:image/svg+xml;base64,PHN2Zy8+', meta: { toolUrl: link, name: 'Pose Geeko', animated: true, durationMs: 8000 } });
  assert.ok(encoded, 'a tool render is portable');
  assert.ok(!encoded.includes('data:'), 'its rendered bytes stay local');
  assert.ok(!encoded.includes('Pose Geeko'), 'and so does its metadata: the opening shell re-renders it');
  assert.deepEqual(decodeCanvasAsset(encoded), { id: link, source: 'remote', type: 'vector', format: 'svg', url: '' });
  for (const id of [
    'https://attacker.test/tool/pose-geeko.svg?x=1',          // another host
    'http://lolly.tools/tool/pose-geeko.svg',                  // not https
    'https://lolly.tools/tool/pose-geeko.exe',                 // not a render format
    'https://lolly.tools/tool/../pose-geeko.svg',              // not a tool id
    'https://lolly.tools/tool/pose-geeko.svg#frag',            // a fragment
    'https://lolly.tools.attacker.test/tool/pose-geeko.svg',   // a lookalike host
    `https://lolly.tools/tool/pose-geeko.svg?${'a'.repeat(3800)}`, // longer than the lane allows
    'https://lolly.tools/tool/pose-geeko.svg?a=\u0001',       // a control character
  ]) assert.equal(encodeCanvasAsset({ id, source: 'remote', type: 'vector', format: 'svg' }), null, id);
  assert.equal(encodeCanvasAsset({ id: 'compose:pose-geeko', source: 'remote', type: 'vector', format: 'svg' }), null,
    'an author-declared compose has no link that can re-render it, so it stays off the lane');
});
