// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePolicy, tag, renderTags, renditionKey, contentAddressedPath, canonicalDeliveryPath, signDeliveryToken, verifyDeliveryToken } from '../src/delivery-v1.ts';

test('all error policies forbid browser and shared storage, including immutable errors', () => {
  for (const cls of ['public-immutable', 'public-revalidate', 'public-bounded', 'link', 'instance-private', 'person-private'] as const) {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
      const policy = cachePolicy(cls, { status });
      assert.equal(policy.cacheControl, 'private, no-store, max-age=0, no-transform');
      assert.equal(policy.cdnCacheControl, 'no-store');
      assert.equal(policy.surrogateControl, undefined);
    }
  }
  assert.match(cachePolicy('public-immutable', { status: 308 }).cacheControl, /no-store/);
});
test('public freshness stays consistent across cache layers and private classes remain private', () => {
  assert.equal(cachePolicy('public-immutable').cacheControl, 'public, max-age=31536000, s-maxage=31536000, immutable, no-transform');
  assert.equal(cachePolicy('public-revalidate').cdnCacheControl, 'max-age=0, must-revalidate, no-transform');
  assert.match(cachePolicy('public-bounded').cacheControl, /s-maxage=86400, stale-while-revalidate=604800, no-transform/);
  assert.equal(cachePolicy('public-bounded', { boundedAgeSec: 90 }).cdnCacheControl, 'max-age=90, no-transform');
  assert.equal(cachePolicy('instance-private').cacheControl, 'private, no-cache, no-transform');
  assert.equal(cachePolicy('instance-private', { boundedAgeSec: 900 }).cacheControl, 'private, max-age=300, no-transform');
  assert.equal(cachePolicy('person-private', { tokenBearing: true }).referrerPolicy, 'no-referrer');
  assert.equal(cachePolicy('public-bounded', { signed: true }).validator, 'weak');
  assert.throws(() => cachePolicy('public-bounded', { boundedAgeSec: -1 }));
});
test('opaque tags have strict grammar and hard provider budgets', () => {
  assert.equal(renderTags([tag('t', 'design'), tag('h', 'abc123')], 'comma'), 't_design,h_abc123');
  assert.equal(renderTags(['t_design', 't_design'], 'space'), 't_design');
  for (const value of ['Andy', 'john@example.com', 'project/name', 'a b', 'x\r\nCache-Control: public', '']) assert.throws(() => tag('p', value));
  assert.throws(() => tag('h', 'x'.repeat(79)));
  assert.throws(() => renderTags(Array(13).fill('t_design'), 'space'));
  assert.throws(() => renderTags(['z_design'], 'space'));
});
test('rendition identities validate dimensions and do not allow underspecified cover', () => {
  assert.equal(renditionKey({ w: 640, fit: 'inside', format: 'webp', q: 80 }), 'w640.inside.webp.q80');
  assert.throws(() => renditionKey({ w: 640, fit: 'cover', format: 'webp' }));
  assert.throws(() => renditionKey({ w: 1.5, fit: 'inside', format: 'webp' }));
  assert.throws(() => renditionKey({ w: 640, fit: 'inside', format: 'webp', q: 101 }));
  assert.equal(contentAddressedPath('/catalog/assets/logo.webp', 'a'.repeat(64)), '/catalog/assets/logo.aaaaaaaaaaaaaaaa.webp');
  assert.throws(() => contentAddressedPath('/file.png?dt=secret', 'a'.repeat(64)));
});
test('strict delivery path rejects normalization attacks before parsing', () => {
  for (const path of ['/e/i/%2e%2e.png', '/e//file.png', '/e/../file.png', '/e/./file.png', '/e/\\file.png', '/e/file.png?dt=x', '/e/file.png#x', '/e/é.png']) assert.equal(canonicalDeliveryPath(path, /^\/e\/.+$/), null);
  assert.equal(canonicalDeliveryPath('/api/mcp/files/abc', /\/api\/mcp\/files\/[a-z]+/g), '/api/mcp/files/abc');
  assert.equal(canonicalDeliveryPath('/api/mcp/files/abc/extra', /\/api\/mcp\/files\/[a-z]+/), null);
});
test('tokens bind exact path, configured host, route class and opaque principal', async () => {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(32).fill(17), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const path = '/api/mcp/files/abc', subject = 'd'.repeat(64);
  const claims = { v: 1, kid: 'a', exp: 1300, cls: 'person-private' } as const;
  const ctx = { canonicalHost: 'lolly.ing', subject, cls: 'person-private', pattern: /^\/api\/mcp\/files\/[a-z]+$/, maxSkewSec: 0 } as const;
  const token = await signDeliveryToken(claims, path, ctx, key);
  const keys = new Map([['a', key]]);
  assert.match(token, /^1\.a\.1300\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifyDeliveryToken(token, path, ctx, keys, 1000), 'ok');
  assert.equal(await verifyDeliveryToken(token, path, ctx, keys, 1299), 'ok');
  assert.equal(await verifyDeliveryToken(token, path, ctx, keys, 1300), 'expired');
  for (const other of [{ ...ctx, subject: 'e'.repeat(64) }, { ...ctx, canonicalHost: 'lolly.tools' }, { ...ctx, cls: 'instance-private' as const }]) assert.notEqual(await verifyDeliveryToken(token, path, other, keys, 1000), 'ok');
  assert.notEqual(await verifyDeliveryToken(token, '/api/mcp/files/xyz', ctx, keys, 1000), 'ok');
  assert.equal(await verifyDeliveryToken(token, path, ctx, new Map(), 1000), 'bad');
  assert.equal(await verifyDeliveryToken(token + 'A', path, ctx, keys, 1000), 'bad');
  assert.equal(await verifyDeliveryToken(token, path, { ...ctx, maxSkewSec: 61 }, keys, 1000), 'bad');
  assert.equal(await verifyDeliveryToken(token, path, { ...ctx, maxSkewSec: 60 }, keys, 1359), 'ok');
  assert.equal(await verifyDeliveryToken(token, path, { ...ctx, maxSkewSec: 60 }, keys, 1360), 'expired');
  assert.equal(await verifyDeliveryToken(token, '/api/mcp/files/%61bc', ctx, keys, 1000), 'scope');
  await assert.rejects(signDeliveryToken(claims, path, { ...ctx, canonicalHost: 'LOLLY.ing' }, key));
});
