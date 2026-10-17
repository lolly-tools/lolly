// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cachePolicy } from '../packages/core/src/delivery-v1.ts';
import type { DeliveryClass } from '../packages/core/src/delivery-v1.ts';
import { CATALOG_SIG_ALG, catalogIndexPath, signCatalogEnvelope } from '../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';
import { absentHash16, catalogProbeSamples, deriveCatalogSamples, derivedSampleCovers, rotatingWindow } from '../scripts/lib/edge-probe-catalog.ts';
import { main, probeSample } from '../scripts/edge-probe.ts';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const sri = (text: string): string => 'sha256-' + createHash('sha256').update(text).digest('base64');
const ORIGIN = 'https://catalog.test';

/** A small public catalog whose bytes, envelope and asset index agree. */
async function fixture(options: { scope?: string } = {}) {
  const bytes = new Map<string, { text: string; cls: DeliveryClass }>();
  const put = (path: string, text: string, cls: DeliveryClass) => { bytes.set(path, { text, cls }); return sha(text); };
  const toolJson = (id: string) => JSON.stringify({ id, version: '1.0.0' });
  const files: Record<string, string> = {}, toolDirs: Record<string, string> = {};
  for (const id of ['alpha', 'beta', 'gamma']) {
    files[`${id}/tool.json`] = sha(toolJson(id));
    toolDirs[id] = sha(`directory ${id}`);
    put(`/tools/${id}@${toolDirs[id].slice(0, 16)}/tool.json`, toolJson(id), 'public-immutable');
    put(`/tools/${id}/tool.json`, toolJson(id), 'public-revalidate');
  }
  const preview = '<svg><rect/></svg>', previewHash = sha(preview);
  const resources = { [`/catalog/previews/alpha.${previewHash.slice(0, 16)}.svg`]: previewHash, '/catalog/previews/alpha.svg': previewHash, '/catalog/previews/bundle.json': sha('{}') };
  put(`/catalog/previews/alpha.${previewHash.slice(0, 16)}.svg`, preview, 'public-immutable');
  put('/catalog/previews/alpha.svg', preview, 'public-revalidate');
  const logo = '<svg><circle/></svg>', logoUrl = `/catalog/assets/demo/logo.${sha(logo).slice(0, 16)}.svg`;
  put(logoUrl, logo, 'public-immutable');
  const assetText = JSON.stringify({ assets: [
    { id: 'demo/logo', formats: [{ url: logoUrl, checksum: sri(logo), size: logo.length }] },
    { id: 'demo/huge', formats: [{ url: `/catalog/assets/demo/huge.${'a'.repeat(16)}.mp4`, checksum: 'sha256-' + Buffer.from('a'.repeat(64), 'hex').toString('base64'), size: 9 * 1024 * 1024 }] },
    { id: 'demo/escape', formats: [{ url: '//elsewhere.test/x.0123456789abcdef.svg', checksum: sri(logo), size: logo.length }] },
  ] });
  const toolText = JSON.stringify({ tools: [] }), slimText = JSON.stringify({ tools: [], slim: true });
  const indexHash = put('/catalog/tools/index.json', toolText, 'public-revalidate');
  put(catalogIndexPath(indexHash), toolText, 'public-immutable');
  const assetIndexHash = put('/catalog/assets/index.json', assetText, 'public-revalidate');
  put(catalogIndexPath(assetIndexHash, 'assets'), assetText, 'public-immutable');
  const slimHash = put('/catalog/tools/index.slim.json', slimText, 'public-revalidate');
  put(catalogIndexPath(slimHash, 'slim'), slimText, 'public-immutable');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const envelope = await signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId: 'fixture', signedAt: '2026-10-17T00:00:00.000Z', seq: 3, indexHash, assetIndexHash, slimHash,
    files, toolDirs, resources, ...(options.scope ? { catalogScope: options.scope } : {}) }, pair.privateKey);
  put('/catalog/tools/index.sig.json', JSON.stringify(envelope), 'public-revalidate');
  const publicKey = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
  return { bytes, envelope, assetIndex: JSON.parse(assetText) as unknown, publicKey, logoUrl };
}

/** A compliant origin: class headers, strong validators, 304s and 404s that are never stored. */
function origin(bytes: Map<string, { text: string; cls: DeliveryClass }>, seen: RequestInit[] = [], options: { spaFallback?: boolean } = {}): typeof fetch {
  return async (input, init) => {
    seen.push(init ?? {});
    const path = new URL(String(input)).pathname, file = bytes.get(path), sent = new Headers(init?.headers);
    if (!file) {
      if (options.spaFallback) { const p = cachePolicy('public-revalidate'); return new Response('<!doctype html>', { headers: { 'cache-control': p.cacheControl, 'cdn-cache-control': p.cdnCacheControl, 'content-type': 'text/html' } }); }
      const p = cachePolicy('public-immutable', { status: 404 });
      return new Response('missing', { status: 404, headers: { 'cache-control': p.cacheControl, 'cdn-cache-control': p.cdnCacheControl } });
    }
    // fetch hands the probe decoded bytes, so a compressed reply only differs by its header here.
    const p = cachePolicy(file.cls), etag = `"${sha(file.text)}"`, coded = /gzip/.test(sent.get('accept-encoding') ?? '') && file.text.length > 1024;
    const headers = { 'cache-control': p.cacheControl, 'cdn-cache-control': p.cdnCacheControl, etag, vary: 'Accept-Encoding', ...(coded ? { 'content-encoding': 'gzip' } : {}) };
    if (sent.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    const range = /^bytes=0-(\d+)$/.exec(sent.get('range') ?? '');
    if (range && sent.get('if-range') === etag) return new Response(file.text.slice(0, Number(range[1]) + 1), { status: 206, headers: { ...headers, 'content-range': `bytes 0-${range[1]}/${file.text.length}` } });
    return new Response(file.text, { headers });
  };
}

test('signed catalog samples cover hashed indexes, tool trees, previews and assets with 304 and 404 checks', async () => {
  const { envelope, assetIndex, logoUrl } = await fixture();
  const samples = catalogProbeSamples(ORIGIN, envelope, assetIndex, { tools: 2 });
  const by = (path: string) => samples.find(sample => sample.path === path);
  assert.equal(by(catalogIndexPath(envelope.indexHash))?.sha256, envelope.indexHash);
  assert.equal(by(catalogIndexPath(envelope.assetIndexHash!, 'assets'))?.cls, 'public-immutable');
  assert.equal(by('/catalog/tools/index.json')?.sha256, envelope.indexHash, 'the legacy index must match its signature');
  assert.equal(by(`/tools/alpha@${envelope.toolDirs!.alpha!.slice(0, 16)}/tool.json`)?.sha256, envelope.files['alpha/tool.json']);
  assert.equal(by('/tools/alpha/tool.json')?.cls, 'public-revalidate');
  assert.equal(samples.filter(sample => sample.path.startsWith('/tools/') && sample.status !== 404).length, 4, 'two tools, hashed and legacy');
  assert.ok(by('/catalog/previews/alpha.svg'), 'the unhashed preview name revalidates to the same bytes');
  assert.equal(by('/catalog/previews/bundle.json'), undefined, 'mutable resources have no hashed address');
  assert.equal(by(logoUrl)?.sha256, sha('<svg><circle/></svg>'));
  assert.equal(samples.some(sample => sample.path.includes('huge') || sample.path.includes('elsewhere')), false, 'oversized and unsafe assets are skipped');
  const missing = samples.filter(sample => sample.status === 404);
  assert.deepEqual(missing.map(sample => sample.path), ['/catalog/tools/index.0000000000000000.json', '/tools/alpha@0000000000000000/tool.json', '/catalog/previews/alpha.0000000000000000.svg', '/catalog/assets/demo/logo.0000000000000000.svg']);
  for (const sample of samples) {
    assert.equal(sample.origin, ORIGIN);
    assert.equal(sample.credentialEnv, undefined);
    if (sample.status !== 404) { assert.equal(sample.checkConditional, true, sample.path); assert.equal(sample.requireStrongETag, true, sample.path); }
  }
});

test('rotation covers every entry over successive days and missing addresses avoid signed digests', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'], seen = new Set<string>();
  for (let day = 0; day < 4; day++) for (const item of rotatingWindow(items, 2, day)) seen.add(item);
  assert.deepEqual([...seen].sort(), items);
  assert.deepEqual(rotatingWindow(items, 2, 3), ['g', 'a']);
  assert.deepEqual(rotatingWindow(['x'], 4, 99), ['x']);
  assert.equal(absentHash16(['0'.repeat(64), '1'.repeat(16) + 'f'.repeat(48)]), '2'.repeat(16));
});

test('derivation verifies the pinned key, sends no credentials and passes on a compliant origin', async () => {
  const { bytes, publicKey } = await fixture(), seen: RequestInit[] = [];
  const derived = await deriveCatalogSamples(ORIGIN, { publicKey, fetcher: origin(bytes, seen), rotation: 0 });
  assert.equal(derived.result.passed, true, JSON.stringify(derived.result.observations));
  assert.equal(derived.result.catalog?.signature, 'verified');
  assert.equal(derived.result.catalog?.seq, 3);
  assert.equal(derived.result.catalog?.samples, derived.samples.length);
  const results = await Promise.all(derived.samples.map(sample => probeSample(sample, origin(bytes, seen))));
  for (const result of results) assert.equal(result.passed, true, `${result.path}: ${result.observations.flatMap(o => o.failures).join(', ')}`);
  assert.ok(results.some(result => result.observations.some(o => o.checks?.some(check => check.kind === 'conditional' && check.status === 304))));
  for (const init of seen) {
    const headers = new Headers(init.headers);
    assert.equal(headers.has('cookie') || headers.has('authorization'), false);
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'manual');
  }
});

test('a forged signature yields no expectations and a missing key cannot qualify', async () => {
  const { bytes, publicKey } = await fixture(), other = await fixture();
  const forged = await deriveCatalogSamples(ORIGIN, { publicKey: other.publicKey, fetcher: origin(bytes) });
  assert.equal(forged.result.passed, false); assert.deepEqual(forged.result.observations[0]!.failures, ['catalog-signature']);
  assert.equal(forged.samples.length, 0); assert.equal(forged.result.catalog?.signature, 'refused');
  const malformed = await deriveCatalogSamples(ORIGIN, { publicKey: '{"kty":"EC"}', fetcher: origin(bytes) });
  assert.deepEqual(malformed.result.observations[0]!.failures, ['catalog-key', 'catalog-signature']); assert.equal(malformed.samples.length, 0);
  const unchecked = await deriveCatalogSamples(ORIGIN, { fetcher: origin(bytes) });
  assert.equal(unchecked.result.passed, false); assert.deepEqual(unchecked.result.observations[0]!.failures, ['catalog-signature-unchecked']);
  assert.equal(unchecked.result.catalog?.signature, 'unchecked'); assert.ok(unchecked.samples.length > 0, 'observation runs still probe the paths');
  const corrupt = new Map(bytes);
  corrupt.set(catalogIndexPath(fixtureHash(bytes, '/catalog/assets/index.json'), 'assets'), { text: '{"assets":[]}', cls: 'public-immutable' });
  const mismatch = await deriveCatalogSamples(ORIGIN, { publicKey, fetcher: origin(corrupt) });
  assert.deepEqual(mismatch.result.observations[0]!.failures, ['catalog-asset-index']);
  assert.equal(mismatch.samples.some(sample => sample.path.startsWith('/catalog/assets/demo/')), false);
});

function fixtureHash(bytes: Map<string, { text: string }>, path: string): string { return sha(bytes.get(path)!.text); }

test('private and scoped catalogs produce no public samples', async () => {
  const refused = await deriveCatalogSamples(ORIGIN, { fetcher: async () => new Response('{}', { status: 401 }) });
  assert.deepEqual(refused.result.observations[0]!.failures, ['catalog-not-public']); assert.equal(refused.samples.length, 0);
  const scoped = await fixture({ scope: 'c'.repeat(64) });
  const instance = await deriveCatalogSamples(ORIGIN, { publicKey: scoped.publicKey, fetcher: origin(scoped.bytes) });
  assert.deepEqual(instance.result.observations[0]!.failures, ['catalog-not-public']); assert.equal(instance.samples.length, 0);
});

test('a missing hashed path answered by the app shell or with immutable headers fails', async () => {
  const sample = { origin: ORIGIN, path: '/catalog/tools/index.0000000000000000.json', cls: 'public-immutable' as const, status: 404 };
  const fallback = await probeSample(sample, origin(new Map(), [], { spaFallback: true }));
  assert.equal(fallback.passed, false); assert.ok(fallback.observations[0]!.failures.includes('status'));
  const immutable = cachePolicy('public-immutable');
  const stored = await probeSample(sample, async () => new Response('missing', { status: 404, headers: { 'cache-control': immutable.cacheControl, 'cdn-cache-control': immutable.cdnCacheControl, age: '30' } }));
  assert.ok(stored.observations[0]!.failures.includes('cache-control')); assert.ok(stored.observations[0]!.failures.includes('private-age'));
  assert.equal((await probeSample(sample, origin(new Map()))).passed, true);
});

test('the CLI records the derivation, replaces plain samples and keeps reviewed checks', async () => {
  const { bytes, publicKey } = await fixture(), previousFetch = globalThis.fetch, previousLog = console.log;
  const previous = { key: process.env.DELIVERY_CATALOG_PUBLIC_KEY_JWK, cookie: process.env.EDGE_PROBE_CATALOG_TEST_COOKIE };
  const lines: string[] = [];
  globalThis.fetch = origin(bytes); process.env.DELIVERY_CATALOG_PUBLIC_KEY_JWK = publicKey; process.env.EDGE_PROBE_CATALOG_TEST_COOKIE = 'reader=a';
  console.log = (line: string) => { lines.push(line); };
  try {
    assert.equal(await main(['--catalog', '--catalog-origins', ORIGIN, '--catalog-rotation', '1', '--samples', fileURLToPath(new URL('./fixtures/edge-probe-catalog-samples.json', import.meta.url))]), 0);
    const summary = JSON.parse(lines.join('\n')) as { passed: boolean; results: Array<{ path: string; passed: boolean; failures: string[] }> };
    assert.equal(summary.passed, true, JSON.stringify(summary.results.filter(result => !result.passed)));
    assert.equal(summary.results[0]!.path, '/catalog/tools/index.sig.json');
    const at = (path: string) => summary.results.filter(result => result.path === path).length;
    assert.equal(at('/catalog/tools/index.json'), 1, 'the signed sample replaces a plain shell sample');
    assert.equal(at('/catalog/assets/index.json'), 2, 'a credentialed reviewed sample runs beside the signed one');
    assert.equal(at('/catalog/previews/alpha.svg'), 2, 'a range-checked reviewed sample runs beside the signed one');
    await assert.rejects(main(['--catalog', '--catalog-origins', 'http://catalog.test']), /HTTPS origins/);
  } finally {
    globalThis.fetch = previousFetch; console.log = previousLog;
    for (const [name, value] of [['DELIVERY_CATALOG_PUBLIC_KEY_JWK', previous.key], ['EDGE_PROBE_CATALOG_TEST_COOKIE', previous.cookie]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('a derived sample replaces a planned one only when it checks everything that one does', () => {
  const derived = { origin: ORIGIN, path: '/catalog/tools/index.json', cls: 'public-revalidate' as const, sha256: 'a'.repeat(64), compress: true, checkConditional: true, requireStrongETag: true };
  const plain = { origin: ORIGIN, path: derived.path, cls: 'public-revalidate' as const };
  assert.equal(derivedSampleCovers({ ...plain, compress: true, checkConditional: true }, derived), true, 'a built-in shell sample');
  assert.equal(derivedSampleCovers({ ...plain, sha256: derived.sha256 }, derived), true, 'the same expected bytes');
  for (const extra of [{ credentialEnv: 'COOKIE' }, { checkRange: true }, { stripC2pa: 'svg' as const }, { requireCors: true }, { boundedAgeSec: 60 },
    { cls: 'public-immutable' as const }, { status: 401 }, { sha256: 'b'.repeat(64) }, { size: 3 }, { method: 'HEAD' as const }]) {
    assert.equal(derivedSampleCovers({ ...plain, ...extra }, derived), false, JSON.stringify(extra));
  }
  assert.equal(derivedSampleCovers({ ...plain, compress: true }, { ...derived, compress: false }), false, 'a compression check the derived sample skips');
});

test('asset index paths cannot steer the probe off its origin or out of the catalog', () => {
  const envelope = { alg: CATALOG_SIG_ALG, keyId: 'k', signedAt: '2026-10-17T00:00:00.000Z', indexHash: 'a'.repeat(64), files: {}, signature: 'x' } as CatalogSignatureEnvelope;
  const samples = catalogProbeSamples(ORIGIN, envelope, { assets: [{ formats: [{ url: '/catalog/../x.0123456789abcdef.svg', checksum: 'sha256-' + Buffer.from('0123456789abcdef'.repeat(4), 'hex').toString('base64'), size: 1 }] }] });
  assert.equal(samples.every(sample => new URL(sample.path, ORIGIN).origin === ORIGIN && !sample.path.includes('..')), true);
});
