// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePolicy } from '../packages/core/src/delivery-v1.ts';
import { probeSample, modelProbeSamples, modelProbeOrigins } from '../scripts/edge-probe.ts';
import { createHash } from 'node:crypto';
import { stripProbeCredential } from '../scripts/lib/edge-probe-bytes.ts';

test('probe detects a private endpoint incorrectly carrying public cache headers', async () => {
  const result = await probeSample({ origin: 'https://example.invalid', path: '/private', cls: 'person-private', status: 401 }, async () => new Response('{}', { status: 401, headers: { 'Cache-Control': 'public, max-age=31536000' } }));
  assert.equal(result.passed, false);
  assert.ok(result.observations[0]!.failures.includes('cache-control'));
});
test('probe qualifies decoded bytes rather than compressed representation length', async () => {
  const p = cachePolicy('public-revalidate');
  const body = 'abc'.repeat(1000);
  let n = 0;
  const result = await probeSample({ origin: 'https://example.invalid', path: '/index.json', cls: 'public-revalidate', compress: true, size: body.length }, async () => new Response(body, { headers: { 'Cache-Control': p.cacheControl, 'CDN-Cache-Control': p.cdnCacheControl, ...(n++ ? { 'Content-Encoding': 'gzip' } : {}), Vary: 'Accept-Encoding' } }));
  assert.equal(result.passed, true);
});
test('probe refuses credential URLs and redirecting to an unrelated origin', async () => {
  await assert.rejects(probeSample({ origin: 'https://example.invalid', path: '/file?dt=secret', cls: 'person-private' }));
  await assert.rejects(probeSample({ origin: 'https://example.invalid', path: 'https://other.invalid/', cls: 'person-private' }));
});
test('model matrix includes each immutable path and legacy alias on all three hosts', () => {
  const samples = modelProbeSamples([{ url: '/models/test/a.onnx', size: 10, sha256: 'a'.repeat(64), immutableUrl: '/models/test@1234567890abcdef/a.onnx' }]);
  assert.equal(samples.length, 6);
  for (const origin of ['https://lolly.tools', 'https://lolly.ing', 'https://lolli.li']) {
    const own = samples.filter(sample => sample.origin === origin);
    assert.equal(own.length, 2); assert.equal(own[0]!.sha256, 'a'.repeat(64)); assert.equal(own[0]!.size, 10);
    assert.equal(own[1]!.sha256, undefined, 'old aliases can retain prior release bytes');
    assert.equal(own[0]!.checkRange, true); assert.equal(own[1]!.checkRange, false);
    assert.equal(own[1]!.method, 'HEAD'); assert.equal(own[1]!.monitoringOnly, true);
    assert.equal(own.every(sample => sample.checkConditional && sample.requireCors), true);
  }
});
test('model origins are explicit HTTPS hosts, with credentials and paths refused', () => {
  assert.deepEqual(modelProbeOrigins('https://lolly.tools,https://lolli.li/,https://lolly.tools'), ['https://lolly.tools', 'https://lolli.li']);
  for (const value of ['https://user:secret@models.test', 'https://models.test/path', 'https://models.test?token=secret', 'http://models.test', '']) assert.throws(() => modelProbeOrigins(value));
});
test('full legacy hash qualification requires archived references for every alias', () => {
  const manifest = [{ url: '/models/test/a.onnx', size: 10, sha256: 'a'.repeat(64), immutableUrl: '/models/test@1234567890abcdef/a.onnx' }];
  assert.throws(() => modelProbeSamples(manifest, ['https://models.test'], { fullLegacy: true }), /archived alias/);
  const samples = modelProbeSamples(manifest, ['https://models.test'], { fullLegacy: true, legacyReferences: [{ origin: 'https://models.test', path: manifest[0]!.url, size: 12, sha256: 'b'.repeat(64) }] });
  assert.equal(samples[1]!.size, 12); assert.equal(samples[1]!.sha256, 'b'.repeat(64)); assert.equal(samples[1]!.checkRange, true);
});
test('legacy HEAD monitoring checks declared size without claiming a byte hash', async () => {
  const policy = cachePolicy('public-revalidate');
  const result = await probeSample({ origin: 'https://models.test', path: '/legacy.onnx', cls: 'public-revalidate', method: 'HEAD', monitoringOnly: true, size: 12, checkConditional: true }, async (_input, init) => {
    assert.equal(init?.method, 'HEAD');
    const status = new Headers(init.headers).has('if-none-match') ? 304 : 200;
    return new Response(null, { status, headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, etag: '"legacy"', 'content-length': '12' } });
  });
  assert.equal(result.passed, true); assert.equal(result.monitoringOnly, true);
  assert.equal(result.observations[0]!.declaredSize, 12);
  assert.equal(result.observations[0]!.decodedSha256, undefined);
  assert.equal(result.observations[0]!.decodedSize, undefined);
});
test('cold decoded bytes, conditional 304 and strong If-Range are checked independently', async () => {
  const body = 'model bytes', policy = cachePolicy('public-immutable'), sha256 = createHash('sha256').update(body).digest('hex');
  const headers = { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, etag: `"${sha256}"`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Content-Range, Accept-Ranges' };
  let calls = 0;
  const result = await probeSample({ origin: 'https://models.test', path: '/models/test@1234567890abcdef/a.onnx', cls: 'public-immutable', size: body.length, sha256, checkRange: true, checkConditional: true, requireCors: true }, async (_input, init) => {
    calls++; const sent = new Headers(init?.headers);
    if (sent.has('if-none-match')) return new Response(null, { status: 304, headers });
    if (sent.has('range')) { assert.equal(sent.get('if-range'), `"${sha256}"`); return new Response(body, { status: 206, headers: { ...headers, 'content-range': `bytes 0-${body.length - 1}/${body.length}` } }); }
    return new Response(body, { headers });
  });
  assert.equal(result.passed, true); assert.equal(calls, 3);
});
test('a lying 304 or invalid range prevents qualification', async () => {
  const policy = cachePolicy('public-immutable');
  const result = await probeSample({ origin: 'https://models.test', path: '/a', cls: 'public-immutable', checkConditional: true, checkRange: true }, async (_url, init) => {
    const headers = { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, etag: '"tag"' };
    if (new Headers(init?.headers).has('if-none-match')) return new Response('body', { headers });
    return new Response('body', { headers });
  });
  assert.equal(result.passed, false); assert.ok(result.observations[0]!.failures.includes('conditional-status')); assert.ok(result.observations[0]!.failures.includes('range-bytes'));
});
test('paired cookie credentials remain out of receipts and private caching/tags are refused', async () => {
  const keyA = 'LOLLY_TEST_PROBE_COOKIE_A', keyB = 'LOLLY_TEST_PROBE_COOKIE_B';
  const previous = [process.env[keyA], process.env[keyB]];
  process.env[keyA] = 'session=private-reader-a'; process.env[keyB] = 'session=private-reader-b';
  const policy = cachePolicy('person-private');
  try {
    const result = await probeSample({ origin: 'https://instance.test', path: '/private', cls: 'person-private', credentialEnv: [keyA, keyB], credentialType: 'cookie' }, async (_url, init) => {
      const cookie = new Headers(init?.headers).get('cookie'); assert.ok(cookie?.startsWith('session='));
      return new Response(cookie!.endsWith('-a') ? 'reader one' : 'reader two', { headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, 'referrer-policy': 'no-referrer', age: '0', 'cache-status': 'edge; hit', 'cache-tag': 'private-tag', etag: cookie! } });
    });
    assert.equal(result.passed, false);
    assert.ok(result.observations[0]!.failures.includes('private-age')); assert.ok(result.observations[0]!.failures.includes('private-shared-cache')); assert.ok(result.observations[0]!.failures.includes('exposed-cache-tags'));
    const receipt = JSON.stringify(result); assert.equal(receipt.includes('session='), false); assert.equal(receipt.includes('private-reader'), false); assert.equal(receipt.includes('private-tag'), false);
  } finally {
    for (const [key, value] of [[keyA, previous[0]], [keyB, previous[1]]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('SVG credential stripping compares the host body while raw-byte hashes remain recorded', async () => {
  const plain = '<svg><rect/></svg>', signed = '<svg xmlns:c2pa="http://c2pa.org"><metadata><c2pa:manifest>AAAA</c2pa:manifest></metadata><rect/></svg>';
  assert.equal(new TextDecoder().decode(stripProbeCredential(new TextEncoder().encode(signed), 'svg')), plain);
  const policy = cachePolicy('public-revalidate');
  const result = await probeSample({ origin: 'https://public.test', path: '/signed.svg', cls: 'public-revalidate', stripC2pa: 'svg', strippedSha256: createHash('sha256').update(plain).digest('hex') }, async () => new Response(signed, { headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl } }));
  assert.equal(result.passed, true); assert.notEqual(result.observations[0]!.decodedSha256, result.observations[0]!.credentialStrippedSha256);
});

test('CORS receipts distinguish access from unsafe reflection and record public response headers', async () => {
  const policy = cachePolicy('public-immutable'), body = '{}';
  const result = await probeSample({ origin: 'https://models.test', path: '/models/test@1234567890abcdef/config.json', cls: 'public-immutable', requireCors: true, corsOrigins: ['null', 'https://lolly.ing', 'https://lolly.tools'], sha256: createHash('sha256').update(body).digest('hex') }, async (_input, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'manual');
    const headers = new Headers(init?.headers); assert.equal(headers.has('cookie'), false); assert.equal(headers.has('authorization'), false);
    return new Response(body, { headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, ...(headers.has('origin') ? { 'access-control-allow-origin': headers.get('origin')! } : {}) } });
  });
  assert.equal(result.passed, false);
  assert.ok(result.observations[0]!.failures.includes('cors-reflection-missing-vary'));
  assert.ok(result.observations[0]!.failures.includes('cors-nonconstant-origin'));
  assert.equal(result.observations[0]!.headers?.['access-control-allow-origin'], 'null');
  assert.equal(result.observations[0]!.headers?.['access-control-allow-credentials'], null);
  assert.ok(result.observations[0]!.checks?.some(check => check.origin === null && check.failures.includes('cors-origin')));
});

test('small-file CORS matrix checks real bytes from extra origins and the no-Origin request', async () => {
  const policy = cachePolicy('public-immutable'), body = '{}', origins: Array<string | null> = [];
  const options = { origin: 'https://models.test', path: '/models/test@1234567890abcdef/config.json', cls: 'public-immutable' as const, requireCors: true, corsOrigins: ['null', 'https://lolly.ing', 'https://lolly.tools'], sha256: createHash('sha256').update(body).digest('hex') };
  const fetcher: typeof fetch = async (_input, init) => {
    origins.push(new Headers(init?.headers).get('origin'));
    return new Response(body, { headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, 'access-control-allow-origin': '*' } });
  };
  const result = await probeSample(options, fetcher);
  assert.equal(result.passed, true); assert.deepEqual(origins, ['null', 'https://lolly.ing', 'https://lolly.tools', null]);
  assert.ok(result.observations[0]!.checks?.every(check => check.kind === 'cors-full-bytes'));
  const changed = await probeSample(options, async (input, init) => {
    const response = await fetcher(input, init);
    return new Headers(init?.headers).get('origin') === 'https://lolly.tools' ? new Response('[]', { headers: response.headers }) : response;
  });
  assert.equal(changed.passed, false); assert.ok(changed.observations[0]!.failures.includes('cors-origin-bytes'));
});

test('daily legacy CORS checks remain HEAD metadata observations with unchanged strong validators', async () => {
  const policy = cachePolicy('public-revalidate');
  const result = await probeSample({ origin: 'https://models.test', path: '/models/test/config.json', cls: 'public-revalidate', method: 'HEAD', monitoringOnly: true, size: 12, requireCors: true, corsOrigins: ['null', 'https://lolly.ing'] }, async (_input, init) => {
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { headers: { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl, 'access-control-allow-origin': '*', 'content-length': '12', etag: '"legacy"' } });
  });
  assert.equal(result.passed, true); assert.equal(result.monitoringOnly, true);
  assert.equal(result.observations[0]!.decodedSha256, undefined);
  assert.ok(result.observations[0]!.checks?.every(check => check.kind === 'cors-head-metadata'));
});
