// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetFiles, selectAssetFile } from './asset-files.ts';
import { parseFileAssetId, buildFileAssetId, parseThemedAssetId, parseTreatedAssetId, stripAssetModifiers } from '../../../../engine/src/asset-modifiers.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
const group = 'ext/brand/example', first = 'a'.repeat(24), second = 'b'.repeat(24);
const files = [{ id: first, format: 'jpeg', url: `/catalog/${group}/original`, name: 'Wide.jpg', width: 3240, height: 1080 },
  { id: second, format: 'jpeg', url: `/catalog/${group}/square`, name: 'Square.jpg', width: 1080, height: 1080 }];
const ref: AssetRef = { source: 'library', id: group, type: 'raster', format: 'jpeg', url: files[0]!.url, version: '1', meta: { name: 'Launch imagery', assetFiles: files } };
test('same-extension files keep distinct identities and their own dimensions', () => {
  const a = selectAssetFile(ref, files[0]!), b = selectAssetFile(ref, files[1]!);
  assert.notEqual(a.id, b.id); assert.notEqual(a.url, b.url);
  assert.equal(a.meta?.width, 3240); assert.equal(b.meta?.width, 1080); assert.equal(b.width, 1080); assert.equal(b.height, 1080);
  assert.equal(b.meta?.assetGroupName, 'Launch imagery'); assert.equal(b.meta?.name, 'Square.jpg');
  assert.deepEqual(parseFileAssetId(b.id), { baseId: group, file: second });
  assert.equal(stripAssetModifiers(b.id), group);
});
test('file selections compose with icon themes and photo treatments without losing the chosen file', () => {
  const id = buildFileAssetId(group, second);
  assert.deepEqual(parseThemedAssetId(id + '&theme=light'), { baseId: id, theme: 'light' });
  assert.deepEqual(parseTreatedAssetId(id + '&treatment=muted'), { baseId: id, treatment: 'muted' });
  assert.equal(stripAssetModifiers(id + '&treatment=muted'), group);
  assert.equal(parseFileAssetId('https://example.test/image?file=' + second).file, null);
  assert.throws(() => buildFileAssetId(group, 'other'), /Invalid/);
});
test('file metadata refuses upstream URLs, duplicate identities and foreign asset paths', () => {
  assert.equal(assetFiles({ assetFiles: [files[0], files[0], { ...files[1], url: 'https://private.example/file' }] }).length, 1);
  const foreign = { ...files[0]!, url: '/catalog/ext/private/secret/file' };
  assert.throws(() => selectAssetFile({ ...ref, meta: { assetFiles: [foreign] } }, foreign), /unavailable/);
  const safe = assetFiles({ assetFiles: [{ ...files[0], thumbnail: 'https://private.example/preview' }] });
  assert.equal(safe[0]?.thumbnail, undefined);
});
