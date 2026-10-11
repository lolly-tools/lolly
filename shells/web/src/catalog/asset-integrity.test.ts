// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetFormatIntegrity, assetIndexIntegrity } from './asset-integrity.ts';

const scope = 'a'.repeat(64);
const checksum = `sha256-${'A'.repeat(43)}=`;
const asset = { id: 'ext/cp_brandfolder/asset-123', provider: 'cp_brandfolder', version: '0123456789abcdef' };
const format = { format: 'png', url: '/catalog/ext/cp_brandfolder/asset-123/attachment-123' };

test('provider attachment and thumbnail metadata remain distinct from hashed content', () => {
  assert.deepEqual(assetFormatIntegrity(asset, format, scope), { kind: 'provider-reference' });
  assert.deepEqual(assetFormatIntegrity(asset, { ...format, checksum }, scope), { kind: 'content', checksum });
  assert.equal(assetIndexIntegrity({ assets: [
    { id: 'local/image', formats: [{ format: 'png', checksum }] },
    { ...asset, formats: [format, { ...format, url: '/catalog/ext/cp_brandfolder/asset-123/other.pdf' },
      { format: 'thumb', url: '/catalog/ext/cp_brandfolder/asset-123/thumb' }], locales: { de: [format] } },
  ] }, scope), undefined);
});

test('the provider exemption requires a scoped signed identity and metadata version', () => {
  for (const candidate of [undefined, '', 'public', 'a'.repeat(63)]) {
    assert.equal(assetFormatIntegrity(asset, format, candidate).kind, 'invalid');
  }
  for (const changed of [{ provider: 'other' }, { id: 'ext/other/asset-123' }, { id: 'local/image' },
    { id: 'ext/cp_brandfolder/asset-123/extra' }, { version: undefined }, { version: 'arbitrary' }]) {
    assert.equal(assetFormatIntegrity({ ...asset, ...changed }, format, scope).kind, 'invalid');
  }
});

test('provider references cannot exempt external URLs, local bytes, or ambiguous paths', () => {
  for (const url of ['https://cdn.brandfolder.com/image.png', '//cdn.brandfolder.com/image.png',
    '/catalog/assets/image.png', '/catalog/renditions/image.webp', '/catalog/inst/image.png',
    '/catalog/ext/other/asset-123/file', '/catalog/ext/cp_brandfolder/other/file',
    '/catalog/ext/cp_brandfolder/asset-123/../file', '/catalog/ext/cp_brandfolder/asset-123/%2e%2e',
    '/catalog/ext/cp_brandfolder/asset-123/a%2fb', '/catalog/ext/cp_brandfolder/asset-123/file?preview=1',
    '/catalog/ext/cp_brandfolder/asset-123/file#x', '/catalog/ext/cp_brandfolder/asset-123/file\\x',
    '/catalog/ext/cp_brandfolder/asset-123/file/x', '/catalog/ext/cp_brandfolder/asset-123/.',
    '/catalog/ext/cp_brandfolder/asset-123/..']) {
    assert.equal(assetFormatIntegrity(asset, { ...format, url }, scope).kind, 'invalid', url);
  }
});

test('provided digests and local or rendition formats always require canonical full SHA-256', () => {
  for (const bad of [null, false, '', 'sha256-abc', `sha256-${'A'.repeat(42)}B=`, 'f'.repeat(64)]) {
    assert.equal(assetFormatIntegrity(asset, { ...format, checksum: bad }, scope).kind, 'invalid');
  }
  for (const url of ['/catalog/assets/picture.png', '/catalog/renditions/picture.webp', '/catalog/inst/picture.png']) {
    assert.equal(assetFormatIntegrity({ id: 'picture' }, { format: 'png', url }, scope).kind, 'invalid');
    assert.deepEqual(assetFormatIntegrity({ id: 'picture' }, { format: 'png', url, checksum }, scope), { kind: 'content', checksum });
  }
  for (const bad of [{ assets: [{ formats: {} }] }, { assets: [{ locales: { de: {} } }] }, { assets: [null] }]) {
    assert.match(assetIndexIntegrity(bad, scope)!, /invalid/);
  }
});
