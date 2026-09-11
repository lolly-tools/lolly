// SPDX-License-Identifier: MPL-2.0
/**
 * S3-compatible send target (plans/129) - the `s3` driver for the user's OWN
 * bucket: AWS S3, MinIO, Cloudflare R2, Backblaze B2, Garage - anything that
 * speaks SigV4. No OAuth and no app registration anywhere: the user enters an
 * endpoint + bucket + key pair in /profile, stored DEVICE-LOCAL by
 * provider-connections (never in a backup, wiped on disconnect), and every
 * upload is a browser-signed PUT straight to their storage.
 *
 * The SigV4 signer lives here in full (WebCrypto HMAC-SHA-256) because pulling
 * an AWS SDK in for one PUT would be absurd. `deriveSigningKey` is pinned to
 * the AWS-documented test vector in the co-located test.
 *
 * REALITY NOTES, stated in the UI too: the BUCKET's CORS config must allow
 * this origin (PUT + the signed headers) - that is the bucket owner's one-time
 * setup, documented in docs/providers-personal/s3.md; and a hosted deploy's
 * connect-src CSP cannot pre-list arbitrary user endpoints, so on locked-down
 * deploys this target is for self-hosted instances (which set their own CSP)
 * and, later, the desktop shell where neither constraint exists. Path-style
 * addressing throughout - the form every S3-compatible accepts.
 */

import { t } from '../i18n.ts';
import {
  getConnection, saveConnection, removeConnection, hasConnection,
} from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import { metaFromHeaders } from './sync-remote.ts';

const KIND = 's3';

export interface S3Config {
  /** e.g. https://s3.eu-central-1.amazonaws.com or https://minio.example.com:9000 */
  endpoint: string;
  /** SigV4 region; 'us-east-1' when the store does not care (MinIO, R2). */
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional key prefix ("lolly/"). */
  prefix?: string;
  /** Optional public base URL for the outcome link (CDN/public bucket only). */
  publicBaseUrl?: string;
}

// ── SigV4 (the whole of it) ───────────────────────────────────────────────────

const te = new TextEncoder();

const hex = (buf: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(buf as ArrayBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? te.encode(data) : data;
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

async function hmac(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, te.encode(data));
}

/** kSigning = HMAC-chain over date/region/service - the AWS-documented
 *  derivation, pinned to their published test vector in the test. */
export async function deriveSigningKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(te.encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/** AWS URI-encoding for a key: every segment percent-encoded, '/' kept. */
export function encodeS3Key(key: string): string {
  return key.split('/').map((seg) =>
    encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}

/** amzDate pair for `when` (defaults to now): ['YYYYMMDDTHHMMSSZ', 'YYYYMMDD']. */
export function amzDates(when = new Date()): [string, string] {
  const iso = when.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [iso, iso.slice(0, 8)];
}

/**
 * Sign one request. Returns the headers to send (host is set by fetch itself
 * but participates in the signature). Pure given `when`; exported for tests.
 */
export async function sigV4Headers(
  cfg: Pick<S3Config, 'region' | 'accessKeyId' | 'secretAccessKey'>,
  method: string,
  url: URL,
  payloadHash: string,
  contentType: string | null,
  when = new Date(),
): Promise<Record<string, string>> {
  const [amzDate, date] = amzDates(when);
  const headers: Record<string, string> = {
    ...(contentType ? { 'content-type': contentType } : {}),
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]!.trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonical = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonical)].join('\n');
  const signature = hex(await hmac(await deriveSigningKey(cfg.secretAccessKey, date, cfg.region, 's3'), stringToSign));
  const { host: _host, ...sendable } = headers;
  return {
    ...sendable,
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// ── Config + connection ───────────────────────────────────────────────────────

function objectUrl(cfg: S3Config, key: string): URL {
  const base = cfg.endpoint.replace(/\/+$/, '');
  return new URL(`${base}/${encodeURIComponent(cfg.bucket)}/${encodeS3Key(key)}`);
}

async function s3Config(): Promise<S3Config | null> {
  const conn = await getConnection(KIND);
  const c = conn?.config;
  if (!c?.endpoint || !c.bucket || !c.accessKeyId || !c.secretAccessKey) return null;
  return {
    endpoint: c.endpoint,
    region: c.region || 'us-east-1',
    bucket: c.bucket,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    prefix: c.prefix || '',
    publicBaseUrl: c.publicBaseUrl || '',
  };
}

/** Save the /profile form as the connection (always at rest: keys the user
 *  chose to store are the whole point of the form; the row says so). */
export async function connectS3(config: S3Config): Promise<void> {
  await saveConnection({
    kind: KIND,
    account: `${config.bucket} (${new URL(config.endpoint).host})`,
    persist: true,
    config: { ...config, prefix: config.prefix ?? '', publicBaseUrl: config.publicBaseUrl ?? '', region: config.region || 'us-east-1' } as unknown as Record<string, string>,
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectS3(): Promise<void> {
  await removeConnection(KIND);
}

/** A signed HEAD on a key that should not exist: 404 = credentials + CORS both
 *  work; 403 = bad keys or clock; a thrown TypeError = CORS/CSP in the way. */
export async function testS3(config: S3Config, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; note: string }> {
  const probe = `${config.prefix ?? ''}.lolly-connection-test-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const url = objectUrl(config, probe);
  try {
    const headers = await sigV4Headers(config, 'HEAD', url, await sha256Hex(new Uint8Array(0)), null);
    const res = await fetchFn(url.toString(), { method: 'HEAD', headers });
    if (res.status === 404) return { ok: true, note: t('Connection works') };
    if (res.status === 403) return { ok: false, note: t('The bucket refused the keys (403) - check key, secret and region') };
    return { ok: res.ok, note: t('The bucket answered {status}', { status: res.status }) };
  } catch {
    return { ok: false, note: t('Could not reach the bucket - its CORS config (and this deploy\'s security policy) must allow this origin') };
  }
}

// ── The SendTarget ────────────────────────────────────────────────────────────

export function s3SendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('S3 bucket'),
    available: () => hasConnection(KIND),
    hint: t('Uploads this file straight to your own S3-compatible bucket with the keys you saved in Profile. They stay on this device - there is no server between you and your storage.'),
    send: async ({ bytes, name, format, mime }) => {
      const cfg = await s3Config();
      if (!cfg) throw new Error(t('Set up your bucket in Profile first'));
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const key = `${cfg.prefix ?? ''}${filename}`;
      const url = objectUrl(cfg, key);
      const headers = await sigV4Headers(cfg, 'PUT', url, await sha256Hex(bytes), mime || 'application/octet-stream');
      let res: Response;
      try {
        res = await fetch(url.toString(), { method: 'PUT', headers, body: bytes as unknown as BodyInit });
      } catch {
        throw new Error(t('Could not reach the bucket - its CORS config (and this deploy\'s security policy) must allow this origin'));
      }
      if (!res.ok) {
        throw new Error(t('Bucket upload failed ({status})', { status: res.status }));
      }
      const publicBase = cfg.publicBaseUrl?.replace(/\/+$/, '');
      return {
        ...(publicBase ? { url: `${publicBase}/${encodeS3Key(key)}` } : {}),
        label: t('Uploaded to {bucket}/{key}', { bucket: cfg.bucket, key }),
      };
    },
  };
}

// ── The SyncRemote (plans/138 B1) ─────────────────────────────────────────────
// Device sync's two-way access over the SAME SigV4 signer the send target uses.
// The sender is PUT-only; sync also needs HEAD (detect a newer snapshot cheaply,
// no download) and GET (fetch it to apply). ONE fixed key holds the whole-person
// snapshot, overwritten each push - last-write-wins at snapshot granularity.
//
// `rev` is the object's ETag (its Last-Modified as a fallback): stable while the
// content is, changes when it changes - exactly what the engine compares. REALITY
// the spike surfaces (documented for the bucket owner): the bucket's CORS config
// must ExposeHeaders ETag (and ideally Last-Modified) or JS can't read the rev and
// newer-detection can't work; the same CORS that already has to allow PUT.

const SYNC_KEY = 'lolly-sync/snapshot.lolly';

const s3Meta = (res: Response, fallbackSize: number): SnapshotMeta => metaFromHeaders(res.headers, fallbackSize);

/** An S3-backed SyncRemote over the user's connected bucket. `objectKey` (under the
 *  bucket prefix) defaults to the device-sync snapshot; the collab rendezvous
 *  (plans/138 Tier C) points it at other keys to read/write signalling blobs.
 *  `fetchFn` is injectable for tests; production uses the global fetch. */
export function s3SyncRemote(fetchFn: typeof fetch = fetch, objectKey: string = SYNC_KEY): SyncRemote {
  const requireCfg = async (): Promise<{ cfg: S3Config; url: URL }> => {
    const cfg = await s3Config();
    if (!cfg) throw new Error(t('Set up your bucket in Profile first'));
    return { cfg, url: objectUrl(cfg, `${cfg.prefix ?? ''}${objectKey}`) };
  };
  const emptyHash = (): Promise<string> => sha256Hex(new Uint8Array(0));

  const head = async (): Promise<SnapshotMeta | null> => {
    const { cfg, url } = await requireCfg();
    const headers = await sigV4Headers(cfg, 'HEAD', url, await emptyHash(), null);
    const res = await fetchFn(url.toString(), { method: 'HEAD', headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('The bucket answered {status}', { status: res.status }));
    return s3Meta(res, 0);
  };

  const get = async (): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> => {
    const { cfg, url } = await requireCfg();
    const headers = await sigV4Headers(cfg, 'GET', url, await emptyHash(), null);
    const res = await fetchFn(url.toString(), { method: 'GET', headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('The bucket answered {status}', { status: res.status }));
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, meta: s3Meta(res, bytes.length) };
  };

  const put = async (bytes: Uint8Array): Promise<SnapshotMeta> => {
    const { cfg, url } = await requireCfg();
    const headers = await sigV4Headers(cfg, 'PUT', url, await sha256Hex(bytes), 'application/octet-stream');
    let res: Response;
    try {
      res = await fetchFn(url.toString(), { method: 'PUT', headers, body: bytes as unknown as BodyInit });
    } catch {
      throw new Error(t('Could not reach the bucket - its CORS config (and this deploy\'s security policy) must allow this origin'));
    }
    if (!res.ok) throw new Error(t('Bucket upload failed ({status})', { status: res.status }));
    // Some buckets don't CORS-expose ETag on the PUT response; a follow-up HEAD
    // recovers the rev so another device's newer-detection stays correct.
    if (!s3Meta(res, 0).rev) { const h = await head(); if (h?.rev) return h; }
    return s3Meta(res, bytes.length);
  };

  return { kind: KIND, head, get, put };
}
