#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Read-only delivery qualification. Credentials are read from environment, never receipts. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cachePolicy } from '../packages/core/src/delivery-v1.ts';
import type { DeliveryClass } from '../packages/core/src/delivery-v1.ts';
import { measureProbeBody } from './lib/edge-probe-bytes.ts';

export interface ProbeSample {
  origin: string;
  path: string;
  cls: DeliveryClass;
  status?: number;
  sha256?: string;
  size?: number;
  boundedAgeSec?: number;
  credentialEnv?: string | [string, string];
  credentialType?: 'bearer' | 'cookie';
  checkConditional?: boolean;
  checkRange?: boolean;
  requireStrongETag?: boolean;
  stripC2pa?: 'svg' | 'png';
  strippedSha256?: string;
  timeoutMs?: number;
  requireCors?: boolean;
  compress?: boolean;
  method?: 'GET' | 'HEAD';
  monitoringOnly?: boolean;
}
export interface ProbeObservation {
  reader: number; coding: string; failures: string[]; status?: number;
  headers?: Record<string, string | null>; decodedSize?: number; decodedSha256?: string;
  credentialStrippedSha256?: string; declaredSize?: number;
  checks?: Array<{ kind: string; status: number; failures: string[] }>;
}
const FIELDS = ['cache-control', 'cdn-cache-control', 'etag', 'content-encoding', 'content-length', 'content-type', 'cache-status', 'age', 'vary', 'content-security-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'referrer-policy', 'accept-ranges'] as const;
const PRIVATE = new Set<DeliveryClass>(['link', 'instance-private', 'person-private']);
const strong = (tag: string | null | undefined): tag is string => !!tag && /^"[^"\r\n]+"$/.test(tag);
const secretQuery = /^(dt|token|pw|password|authorization|cookie|x-amz-.+|signature|sig)$/i;
export async function probeSample(sample: ProbeSample, fetcher = fetch) {
  const url = new URL(sample.path, sample.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin !== new URL(sample.origin).origin) throw new Error('Probe must stay on its declared origin');
  if ([...url.searchParams.keys()].some(k => secretQuery.test(k))) throw new Error('Probe credentials must not be in URLs');
  const names = typeof sample.credentialEnv === 'string' ? [sample.credentialEnv] : sample.credentialEnv ?? [];
  const credentials = names.map(name => process.env[name]);
  if (credentials.some(value => !value)) throw new Error('Probe credential environment variable is absent');
  if (names.length > 1 && !PRIVATE.has(sample.cls)) throw new Error('Paired credential probes require a private class');
  const readers = credentials.length ? credentials : [undefined];
  const timeout = sample.timeoutMs ?? (sample.size && sample.size > 50 * 1024 * 1024 ? 180_000 : 30_000);
  const observations: ProbeObservation[] = [];
  const checkHeaders = (response: Response, failures: string[]) => {
    const headers = Object.fromEntries(FIELDS.map(k => [k, response.headers.get(k)]));
    const expected = cachePolicy(sample.cls, { status: response.status, boundedAgeSec: sample.boundedAgeSec });
    if (headers['cache-control'] !== expected.cacheControl && !(sample.path === '/sw.js' && headers['cache-control'] === 'no-cache, s-maxage=0, no-transform')) failures.push('cache-control');
    if (headers['cdn-cache-control'] !== (sample.path === '/sw.js' ? 'no-store' : expected.cdnCacheControl)) failures.push('cdn-cache-control');
    if (headers.vary && headers.vary.toLowerCase() !== 'accept-encoding') failures.push('vary');
    if (sample.requireCors && response.headers.get('access-control-allow-origin') !== '*') failures.push('cors');
    if (['cache-tag', 'surrogate-key', 'x-cache-tag', 'x-cache-tags'].some(name => response.headers.has(name))) failures.push('exposed-cache-tags');
    if (PRIVATE.has(sample.cls) || response.status >= 400) {
      if (PRIVATE.has(sample.cls) && headers['referrer-policy'] !== 'no-referrer') failures.push('private-referrer');
      if (response.headers.has('age')) failures.push('private-age');
      if (/\b(hit|cached|stored)\b/i.test([response.headers.get('cache-status'), response.headers.get('x-cache'), response.headers.get('cf-cache-status')].join(' '))) failures.push('private-shared-cache');
    }
    return headers;
  };
  for (let reader = 0; reader < readers.length; reader++) for (const coding of sample.compress ? ['identity', 'gzip, br'] : ['identity']) {
    try {
      const credential = readers[reader];
      const requestHeaders: Record<string, string> = { 'Accept-Encoding': coding, ...(sample.requireCors ? { Origin: 'null' } : {}), ...(credential ? { [sample.credentialType === 'cookie' ? 'Cookie' : 'Authorization']: sample.credentialType === 'cookie' ? credential : `Bearer ${credential}` } : {}) };
      const request = (extra: Record<string, string> = {}) => fetcher(url, { method: sample.method ?? 'GET', headers: { ...requestHeaders, ...extra }, redirect: 'manual', signal: AbortSignal.timeout(timeout), cache: 'no-cache' });
      const response = await request();
      const measured = await measureProbeBody(response, sample.stripC2pa);
      const failures: string[] = [], headers = checkHeaders(response, failures);
      if (response.status !== (sample.status ?? 200)) failures.push('status');
      const head = sample.method === 'HEAD';
      const declaredSize = headers['content-length'] !== null ? Number(headers['content-length']) : undefined;
      if (!head && sample.sha256 && sample.sha256 !== measured.sha256) failures.push('decoded-sha256');
      if (sample.size !== undefined && sample.size !== (head ? declaredSize : measured.size)) failures.push(head ? 'declared-size' : 'decoded-size');
      if (head && measured.size !== 0) failures.push('head-body');
      if (sample.strippedSha256 && sample.strippedSha256 !== measured.strippedSha256) failures.push('credential-stripped-sha256');
      if (sample.compress && coding !== 'identity' && measured.size > 1024 && !['gzip', 'br'].includes(headers['content-encoding'] ?? '')) failures.push('origin-compression');
      if (sample.requireStrongETag && !strong(headers.etag)) failures.push('strong-etag');
      const checks: Array<{ kind: string; status: number; failures: string[] }> = [];
      if (response.status === 200 && sample.checkConditional) {
        const problems: string[] = [];
        if (!headers.etag) problems.push('etag-absent');
        else {
          const warm = await request({ 'If-None-Match': headers.etag }), body = await measureProbeBody(warm);
          checkHeaders(warm, problems);
          if (warm.status !== 304) problems.push('conditional-status');
          if (body.size !== 0) problems.push('conditional-body');
          if (warm.headers.get('etag') !== headers.etag) problems.push('conditional-etag');
          checks.push({ kind: 'conditional', status: warm.status, failures: problems });
        }
        if (!headers.etag) checks.push({ kind: 'conditional', status: 0, failures: problems });
        failures.push(...problems);
      }
      if (!head && response.status === 200 && coding === 'identity' && sample.checkRange) {
        const problems: string[] = [], end = Math.min(measured.size, 32) - 1;
        if (!headers.etag || end < 0) problems.push('range-validator-absent');
        else {
          const ranged = await request({ Range: `bytes=0-${end}`, 'If-Range': headers.etag }), body = await measureProbeBody(ranged);
          checkHeaders(ranged, problems);
          if (strong(headers.etag)) {
            if (ranged.status !== 206 || ranged.headers.get('content-range') !== `bytes 0-${end}/${measured.size}` || body.size !== end + 1 || !Buffer.from(body.prefix).equals(Buffer.from(measured.prefix))) problems.push('range-bytes');
            if (ranged.headers.get('etag') !== headers.etag) problems.push('range-etag');
            if (ranged.headers.has('content-encoding')) problems.push('range-content-encoding');
          } else if (ranged.status !== 200 || body.sha256 !== measured.sha256) problems.push('weak-if-range');
          checks.push({ kind: 'range', status: ranged.status, failures: problems });
        }
        if (!headers.etag || end < 0) checks.push({ kind: 'range', status: 0, failures: problems });
        failures.push(...problems);
      }
      // A server could echo credentials even in an ETag. Record only presence
      // for authenticated probes; checks above still use actual header values.
      const recordedHeaders = credential ? Object.fromEntries(FIELDS.map(name => [name, headers[name] === null ? null : '[present]'])) : headers;
      observations.push({ reader, coding, status: response.status, headers: recordedHeaders, ...(head ? { declaredSize } : { decodedSize: measured.size, decodedSha256: measured.sha256 }), ...(measured.strippedSha256 ? { credentialStrippedSha256: measured.strippedSha256 } : {}), checks, failures });
    } catch { observations.push({ reader, coding, failures: ['request-failed'] }); }
  }
  for (let reader = 0; reader < readers.length; reader++) {
    const copies = observations.filter(o => o.reader === reader && 'decodedSha256' in o);
    if (copies.length === 2 && copies[0]!.decodedSha256 !== copies[1]!.decodedSha256) copies[1]!.failures.push('encoding-changed-decoded-bytes');
  }
  if (readers.length === 2) {
    const copies = observations.filter(o => o.coding === 'identity' && 'decodedSha256' in o);
    if (copies.length === 2 && copies[0]!.decodedSha256 === copies[1]!.decodedSha256) copies[1]!.failures.push('private-readers-identical');
  }
  return { origin: url.origin, path: url.pathname, cls: sample.cls, method: sample.method ?? 'GET', ...(sample.monitoringOnly ? { monitoringOnly: true } : {}), observations, passed: observations.every(o => o.failures.length === 0) };
}
export interface ModelAliasReference { origin: string; path: string; size: number; sha256: string }
/** Explicit deployment origins, never a URL carrying a path or credentials. */
export function modelProbeOrigins(value: string): string[] {
  const origins = value.split(',').map(item => {
    const url = new URL(item.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Model hosts must be HTTPS origins without paths or credentials');
    return url.origin;
  });
  if (!origins.length || origins.length > 8) throw new Error('Configure between one and eight model origins');
  return [...new Set(origins)];
}
export function modelProbeSamples(manifest: Array<{ url: string; size: number; sha256?: string; immutableUrl?: string }>, origins = ['https://lolly.tools', 'https://lolly.ing', 'https://lolli.li'], options: { fullLegacy?: boolean; legacyReferences?: ModelAliasReference[] } = {}): ProbeSample[] {
  return origins.flatMap(origin => manifest.flatMap(file => {
    if (!file.sha256 || !/^[a-f0-9]{64}$/.test(file.sha256) || !file.immutableUrl) throw new Error('Model probe requires complete hashed manifest entries');
    const reference = options.legacyReferences?.find(item => item.origin === origin && item.path === file.url);
    if (options.fullLegacy && (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256) || !Number.isSafeInteger(reference.size))) throw new Error('Full legacy qualification needs an archived alias digest and size for every host/path');
    return [
      { origin, path: file.immutableUrl, cls: 'public-immutable' as const, size: file.size, sha256: file.sha256, checkConditional: true, checkRange: true, requireStrongETag: true, requireCors: true },
      // Aliases are retained for old releases and can intentionally hold earlier bytes.
      { origin, path: file.url, cls: 'public-revalidate' as const, checkConditional: true, checkRange: !!options.fullLegacy, requireStrongETag: true, requireCors: true, size: reference?.size ?? file.size, ...(options.fullLegacy ? { sha256: reference!.sha256 } : { method: 'HEAD' as const, monitoringOnly: true }) },
    ];
  }));
}
export async function main(args = process.argv.slice(2)): Promise<number> {
  const option = (name: string) => args[args.indexOf(name) + 1];
  if (args.includes('--help')) {
    console.log('node scripts/edge-probe.ts [--samples sample.json] [--out receipt.json] [--observe]\nSamples contain origin, path, cls and optional status/sha256/size/boundedAgeSec/credentialEnv/compress/checkConditional/checkRange/stripC2pa. --models hashes immutable models and monitors alias HEAD/size on three hosts. --full-legacy --legacy-reference reference.json hashes aliases against archived {origin,path,size,sha256} records. Paired credentialEnv names with credentialType:cookie test distinct private readers. GET and HEAD only. --observe records failures without qualifying the target.');
    return 0;
  }
  const samples: ProbeSample[] = args.includes('--samples') ? JSON.parse(readFileSync(option('--samples')!, 'utf8')) : [
    ...['https://lolly.tools', 'https://lolly.ing'].flatMap(origin => [
      { origin, path: '/', cls: 'public-revalidate' as const, compress: true },
      { origin, path: '/sw.js', cls: 'public-revalidate' as const, compress: true },
      { origin, path: '/catalog/tools/index.json', cls: origin.endsWith('.ing') ? 'person-private' as const : 'public-revalidate' as const, status: origin.endsWith('.ing') ? 401 : 200, compress: true },
    ]),
  ];
  if (args.includes('--full-legacy') && !args.includes('--legacy-reference')) throw new Error('--full-legacy requires --legacy-reference <archived-alias-json>');
  if (args.includes('--models') || args.includes('--full-legacy')) samples.push(...modelProbeSamples(JSON.parse(readFileSync(new URL('../shells/web/models-manifest.json', import.meta.url), 'utf8')), args.includes('--model-origins') ? modelProbeOrigins(option('--model-origins')!) : undefined, {
    fullLegacy: args.includes('--full-legacy'), legacyReferences: args.includes('--legacy-reference') ? JSON.parse(readFileSync(option('--legacy-reference')!, 'utf8')) : undefined,
  }));
  if (!Array.isArray(samples) || samples.length > 2000) throw new Error('Invalid probe sample count');
  const results = [];
  // Bounded concurrency avoids bursts against a live shared workspace.
  for (let i = 0; i < samples.length; i += 4) results.push(...await Promise.all(samples.slice(i, i + 4).map(s => probeSample(s))));
  const receipt = { format: 'lolly-delivery-probe-v1', checkedAt: new Date().toISOString(), mode: args.includes('--observe') ? 'observation' : 'qualification', passed: results.every(r => r.passed), results };
  if (args.includes('--out')) writeFileSync(option('--out')!, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ...receipt, results: results.map(r => ({ origin: r.origin, path: r.path, passed: r.passed, failures: r.observations.flatMap(o => o.failures) })) }, null, 2));
  return receipt.passed || args.includes('--observe') ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then(code => { process.exitCode = code; }).catch(() => { console.error('Delivery probe failed; no credentials recorded.'); process.exitCode = 1; });
