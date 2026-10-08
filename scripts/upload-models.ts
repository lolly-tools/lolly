#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Publish one model family from shells/web/public/models/<family>/ to the model host,
 * the `lolly` bucket on UpCloud Object Storage that https://lolli.li/models/ serves.
 *
 *   node scripts/upload-models.ts --family=sing --dry-run   # list what would change
 *   node scripts/upload-models.ts --family=sing             # upload what is missing
 *
 * OPERATOR-RUN ONLY. Credentials are the release keys in the device-private store,
 * `${LOLLY_PRIVATE_DIR:-~/Build/lolly-private}/lolly/release-s3.json`
 * (security/local-credential-storage.md); nothing is read from the public checkout.
 *
 * Rules it keeps:
 *   - it only ever writes keys under `models/<family>/`;
 *   - an object already present with the same size is left alone, so a re-run
 *     resumes; one present with a DIFFERENT size stops the run unless --replace is
 *     given, because a model file at a published URL is a promise to every client;
 *   - it never deletes anything.
 *
 * Requests are signed with AWS Signature Version 4 by hand (no SDK). Each body is
 * read whole and its real SHA-256 is sent as x-amz-content-sha256: UpCloud refuses
 * streaming and unsigned payloads (see the release-hosting notes). After an upload
 * it reads the first bytes back through https://lolli.li and checks the CORS header,
 * which the web shell needs because it fetches models cross-origin.
 *
 * Afterwards: `node scripts/gen-models-manifest.ts` so the committed listing matches.
 */
import { createHash, createHmac } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENDPOINT = process.env.LOLLY_MODELS_S3_ENDPOINT ?? 'https://dq0o8.upcloudobjects.com';
const REGION = process.env.LOLLY_MODELS_S3_REGION ?? 'europe-2';
const BUCKET = process.env.LOLLY_MODELS_S3_BUCKET ?? 'lolly';
const PUBLIC_BASE = process.env.LOLLY_MODELS_PUBLIC_BASE ?? 'https://lolli.li';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const family = arg('family');
const dryRun = process.argv.includes('--dry-run');
const replace = process.argv.includes('--replace');
if (!family || !/^[a-z0-9-]+$/.test(family)) {
  console.error('usage: node scripts/upload-models.ts --family=<name> [--dry-run] [--replace]');
  process.exit(2);
}

const privateDir = process.env.LOLLY_PRIVATE_DIR ?? join(homedir(), 'Build/lolly-private');
const creds = JSON.parse(readFileSync(join(privateDir, 'lolly/release-s3.json'), 'utf8')) as { access_key_id?: string; secret_access_key?: string };
if (!creds.access_key_id || !creds.secret_access_key) {
  console.error('release-s3.json has no access_key_id/secret_access_key');
  process.exit(2);
}
const ACCESS = creds.access_key_id;
const SECRET = creds.secret_access_key;

const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();
const encodeKey = (key: string): string => key.split('/').map((s) => encodeURIComponent(s)).join('/');

function signed(method: 'HEAD' | 'PUT', key: string, payloadHash: string, extra: Record<string, string> = {}): { url: string; headers: Record<string, string> } {
  const url = new URL(`${ENDPOINT}/${BUCKET}/${encodeKey(key)}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extra };
  // Every header name here is already lower case, which is the canonical form.
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((h) => `${h}:${String(headers[h]).trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${REGION}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${SECRET}`, day);
  const kSigning = hmac(hmac(hmac(kDate, REGION), 's3'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  const out: Record<string, string> = { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
  delete out.host;
  return { url: url.href, headers: out };
}

const CONTENT_TYPES: Record<string, string> = {
  onnx: 'application/octet-stream',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  bin: 'application/octet-stream',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.endsWith('.part')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

const base = join(ROOT, 'shells/web/public/models', family);
const files = walk(base);
if (!files.length) {
  console.error(`nothing under ${relative(ROOT, base)}`);
  process.exit(2);
}

let uploaded = 0;
let skipped = 0;
for (const file of files) {
  const rel = relative(base, file).split(sep).join('/');
  const key = `models/${family}/${rel}`;
  const ext = rel.split('.').pop() ?? '';
  const type = CONTENT_TYPES[ext];
  if (!type) {
    console.error(`refusing ${rel}: no content type for ".${ext}" (an extensionless name 404s on the static host)`);
    process.exit(1);
  }
  const size = statSync(file).size;
  const head = signed('HEAD', key, sha256(''));
  const existing = await fetch(head.url, { method: 'HEAD', headers: head.headers });
  if (existing.ok) {
    const have = Number(existing.headers.get('content-length'));
    if (have === size) {
      console.log(`present  ${key} (${size} bytes)`);
      skipped++;
      continue;
    }
    if (!replace) {
      console.error(`STOP: ${key} exists with ${have} bytes, local file has ${size}. Re-run with --replace only if replacing a published model is intended.`);
      process.exit(1);
    }
  } else if (existing.status !== 404) {
    console.error(`HEAD ${key} answered ${existing.status}; stopping`);
    process.exit(1);
  }
  if (dryRun) {
    console.log(`would put ${key} (${size} bytes, ${type})`);
    continue;
  }
  const body = readFileSync(file);
  const put = signed('PUT', key, sha256(body), { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' });
  const res = await fetch(put.url, { method: 'PUT', headers: put.headers, body });
  if (!res.ok) {
    console.error(`PUT ${key} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const check = await fetch(`${PUBLIC_BASE}/${encodeKey(key)}`, { headers: { range: 'bytes=0-15', origin: 'null' } });
  const cors = check.headers.get('access-control-allow-origin');
  if (!(check.status === 206 || check.status === 200) || !cors) {
    console.error(`uploaded ${key}, but ${PUBLIC_BASE} answered ${check.status} with CORS ${cors ?? 'missing'}`);
    process.exit(1);
  }
  console.log(`put      ${key} (${size} bytes) -> ${PUBLIC_BASE}/${key} [${check.status}, CORS ${cors}]`);
  uploaded++;
}
console.log(`${dryRun ? 'dry run: ' : ''}${uploaded} uploaded, ${skipped} already present.`);
