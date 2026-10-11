#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Publish verified immutable model directories and retain legacy aliases forever. */
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileSha256, type ModelManifestEntry } from './gen-models-manifest.ts';
import { modelCorsFailures, modelCorsOrigins } from './lib/model-cors.ts';

export interface ModelInventoryObservation {
  /** Configured public origin for later public qualification. */
  origin: string;
  path: string;
  immutable: boolean;
  status: number;
  /** Present only after a complete HTTP 200 body has been read. */
  size?: number;
  sha256?: string;
}
export interface ModelPublisherOptions {
  endpoint: string; region: string; bucket: string; publicBase: string; access: string; secret: string;
  sourceRoot: string; dryRun?: boolean; fetcher?: typeof fetch; log?: (message: string) => void;
  /** Browser consumers to check anonymously, in addition to a no-Origin request. */
  corsOrigins?: readonly string[];
  /** Archive inventory bytes already read; this hook never requests another copy. */
  observeInventory?: (observation: Readonly<ModelInventoryObservation>) => void | Promise<void>;
}
const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hmac = (key: string | Buffer, text: string) => createHmac('sha256', key).update(text).digest();
const encodedKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');
function signed(method: 'GET' | 'PUT', key: string, sha: string, opts: ModelPublisherOptions, extra: Record<string, string> = {}) {
  const url = new URL(`${opts.endpoint}/${opts.bucket}/${encodedKey(key)}`), date = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), day = date.slice(0, 8);
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': sha, 'x-amz-date': date, ...extra };
  const names = Object.keys(headers).sort(), headerNames = names.join(';');
  const request = [method, url.pathname, '', names.map(n => `${n}:${headers[n]!.trim()}\n`).join(''), headerNames, sha].join('\n');
  const scope = `${day}/${opts.region}/s3/aws4_request`, signingKey = hmac(hmac(hmac(hmac(`AWS4${opts.secret}`, day), opts.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(['AWS4-HMAC-SHA256', date, scope, digest(request)].join('\n')).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${opts.access}/${scope}, SignedHeaders=${headerNames}, Signature=${signature}`; delete headers.host;
  return { url: url.href, headers };
}
async function responseDigest(response: Response): Promise<{ sha256: string; size: number }> {
  const hash = createHash('sha256'); let size = 0;
  if (response.body) {
    const reader = response.body.getReader();
    for (;;) { const item = await reader.read(); if (item.done) break; hash.update(item.value); size += item.value.length; }
  }
  else { const bytes = new Uint8Array(await response.arrayBuffer()); hash.update(bytes); size = bytes.length; }
  return { sha256: hash.digest('hex'), size };
}
const mime = (key: string) => key.endsWith('.json') ? 'application/json' : key.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/octet-stream';
function publicModelUrl(publicBase: string, path: string): URL {
  const base = new URL(publicBase), url = new URL(path, base);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/' || url.origin !== base.origin || url.search || url.hash) throw new Error('Public model verification requires an origin and a plain path');
  return url;
}
/** Read small files fully from every origin. For large weights, one full hash is
 * followed by HEAD checks against the same strong validator and declared size. */
export async function verifyPublicModel(file: Pick<ModelManifestEntry, 'size' | 'sha256'>, path: string, opts: Pick<ModelPublisherOptions, 'publicBase' | 'fetcher' | 'corsOrigins'>): Promise<void> {
  const url = publicModelUrl(opts.publicBase, path);
  const fetcher = opts.fetcher ?? fetch, origins: Array<string | null> = [...modelCorsOrigins(opts.corsOrigins), null];
  let etag: string | null = null;
  for (const [index, origin] of origins.entries()) {
    const head = index > 0 && file.size > 1024 * 1024;
    const probe = await fetcher(url.href, { method: head ? 'HEAD' : 'GET', headers: { 'accept-encoding': 'identity', ...(origin === null ? {} : { origin }) }, credentials: 'omit', redirect: 'manual', cache: 'no-cache', signal: AbortSignal.timeout(file.size > 50 * 1024 * 1024 ? 180_000 : 30_000) });
    const failures = modelCorsFailures(probe.headers, origin, ['etag', 'content-range', 'accept-ranges']);
    if (probe.status !== 200) failures.push('status');
    if (probe.headers.has('content-encoding')) failures.push('identity-encoding');
    if (head) {
      if (!etag || !/^"[^"\r\n]+"$/.test(etag) || probe.headers.get('etag') !== etag) failures.push('origin-validator');
      if (probe.headers.get('content-length') !== String(file.size)) failures.push('origin-size');
    }
    if (failures.length) { await probe.body?.cancel(); throw new Error(`Public model/CORS verification failed: ${path} (${origin ?? 'no Origin'}: ${failures.join(', ')})`); }
    if (head) { await probe.body?.cancel(); continue; }
    const actual = await responseDigest(probe);
    if (actual.sha256 !== file.sha256 || actual.size !== file.size) throw new Error(`Public model digest mismatch: ${path} (${origin ?? 'no Origin'})`);
    etag ??= probe.headers.get('etag');
  }
}
/** GET hashes existing objects. If-None-Match:* also prevents races with another
 * publisher between verification and PUT. No key is overwritten or deleted. */
export async function publishModels(entries: readonly ModelManifestEntry[], opts: ModelPublisherOptions): Promise<void> {
  const fetcher = opts.fetcher ?? fetch, log = opts.log ?? console.log;
  const origin = publicModelUrl(opts.publicBase, '/').origin;
  modelCorsOrigins(opts.corsOrigins);
  for (const file of entries) {
    const family = /^\/models\/([a-z0-9-]+)\//.exec(file.url)?.[1];
    if (!family || !/^[a-f0-9]{64}$/.test(file.directorySha256) || file.immutableUrl !== file.url.replace(`/models/${family}/`, `/models/${family}@${file.directorySha256.slice(0, 16)}/`)) throw new Error('Invalid model directory mapping');
    if (!/^\/models\/[a-z0-9-]+\/[a-zA-Z0-9_./-]+$/.test(file.url) || !/^\/models\/[a-z0-9-]+@[a-f0-9]{16}\/[a-zA-Z0-9_./-]+$/.test(file.immutableUrl) || [file.url, file.immutableUrl].some(p => p.split('/').some(s => s === '.' || s === '..')) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid model publication entry');
    const source = join(opts.sourceRoot, file.url.slice('/models/'.length));
    if (await fileSha256(source) !== file.sha256) throw new Error(`Local model integrity mismatch: ${file.url}`);
    for (const [url, immutable] of [[file.immutableUrl, true], [file.url, false]] as const) {
      const key = url.slice(1), get = signed('GET', key, digest(''), opts);
      const present = await fetcher(get.url, { headers: get.headers });
      if (present.status === 200) {
        const actual = await responseDigest(present);
        await opts.observeInventory?.(Object.freeze({ origin, path: url, immutable, status: present.status, ...actual }));
        if (actual.sha256 !== file.sha256 || actual.size !== file.size) {
          if (immutable) throw new Error(`Immutable model collision: ${url}`);
          log(`Retained previous legacy bytes: ${url} (sha256 ${actual.sha256})`); continue;
        }
        log(`Verified existing ${url}`);
      } else {
        await opts.observeInventory?.(Object.freeze({ origin, path: url, immutable, status: present.status }));
        if (present.status !== 404) throw new Error(`Model inventory failed: ${present.status} for ${url}`);
        if (opts.dryRun) { log(`Would publish ${url} (${file.size} bytes)`); continue; }
        const bytes = await readFile(source);
        if (bytes.length !== file.size || digest(bytes) !== file.sha256) throw new Error(`Local model changed before upload: ${url}`);
        const put = signed('PUT', key, file.sha256, opts, { 'if-none-match': '*', 'content-type': mime(key), 'cache-control': immutable ? 'public, max-age=31536000, s-maxage=31536000, immutable, no-transform' : 'public, max-age=0, s-maxage=0, must-revalidate, no-transform', 'x-amz-meta-sha256': file.sha256 });
        const uploaded = await fetcher(put.url, { method: 'PUT', headers: put.headers, body: bytes });
        if (!uploaded.ok) throw new Error(`Model PUT failed: ${uploaded.status} for ${url}; no overwrite was attempted`);
      }
      if (opts.dryRun) continue;
      await verifyPublicModel(file, url, opts);
      log(`Published and verified ${url}`);
    }
  }
}
export async function publishModelsCli(): Promise<void> {
  if (process.argv.includes('--replace')) throw new Error('--replace is forbidden. Changed models require a new hashed directory.');
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const sourceRoot = arg('source-root'), family = arg('family');
  if (!sourceRoot || !family || !/^[a-z0-9-]+$/.test(family)) throw new Error('Usage: --source-root=<models-dir> --family=<name> [--manifest=<json>] [--dry-run]');
  const manifest = JSON.parse(await readFile(resolve(arg('manifest') ?? join(import.meta.dirname, '../shells/web/models-manifest.json')), 'utf8')) as ModelManifestEntry[];
  const entries = manifest.filter(file => file.url.startsWith(`/models/${family}/`));
  if (!entries.length) throw new Error(`No model manifest entries for ${family}`);
  const privateDir = process.env.LOLLY_PRIVATE_DIR ?? join(homedir(), 'Build/lolly-private');
  const creds = JSON.parse(await readFile(join(privateDir, 'lolly/release-s3.json'), 'utf8')) as { access_key_id: string; secret_access_key: string };
  if (!creds.access_key_id || !creds.secret_access_key) throw new Error('Missing private model publication credentials');
  await publishModels(entries, { sourceRoot: resolve(sourceRoot), endpoint: process.env.LOLLY_MODELS_S3_ENDPOINT ?? 'https://dq0o8.upcloudobjects.com', region: process.env.LOLLY_MODELS_S3_REGION ?? 'europe-2', bucket: process.env.LOLLY_MODELS_S3_BUCKET ?? 'lolly', publicBase: process.env.LOLLY_MODELS_PUBLIC_BASE ?? 'https://lolli.li', access: creds.access_key_id, secret: creds.secret_access_key, dryRun: process.argv.includes('--dry-run'), ...(process.env.LOLLY_MODELS_CORS_ORIGINS ? { corsOrigins: process.env.LOLLY_MODELS_CORS_ORIGINS.split(',') } : {}) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await publishModelsCli();
