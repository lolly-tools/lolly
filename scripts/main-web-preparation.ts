#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Request a web-image candidate after the exact successful normal main CI run.
 * This helper has no production transport, promotion or infrastructure action. */
import { webcrypto } from 'node:crypto';
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webGpuReleaseProblems } from './webgpu-release-gate.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const LIMIT = 65536;

type JsonObject = Record<string, unknown>;
export interface CandidateRequest { method: 'GET' | 'POST'; path: string; body?: JsonObject }
export type CandidateApi = (request: CandidateRequest) => Promise<unknown>;
export type MainWebPreparation =
  | { result: 'HELD'; reason: 'release-gate'; problems: string[] }
  | { result: 'SKIPPED'; reason: 'untrusted-trigger' | 'unqualified-run' | 'stale-main' }
  | { result: 'REQUESTED'; source: string; ciRun: string };

function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function runTrusted(value: unknown, repository: string): boolean {
  const run = object(value);
  return Number.isSafeInteger(run.id) && Number(run.id) > 0 && Number.isSafeInteger(run.run_attempt) && Number(run.run_attempt) > 0
    && run.path === '.github/workflows/ci.yml' && run.event === 'push' && run.head_branch === 'main'
    && typeof run.head_sha === 'string' && SHA.test(run.head_sha) && run.status === 'completed' && run.conclusion === 'success'
    && object(run.repository).full_name === repository && object(run.head_repository).full_name === repository;
}

/** Keep the published coordinates; discard optional JWK presentation metadata. */
export async function publicCandidatePin(text: string | undefined): Promise<string> {
  require(typeof text === 'string' && Buffer.byteLength(text) <= 1024, 'Missing or oversized published public key');
  let key: JsonObject;
  try { key = object(JSON.parse(text)); } catch { throw new Error('Invalid published public key'); }
  require(key.kty === 'EC' && key.crv === 'P-256' && !Object.hasOwn(key, 'd'), 'Expected a public EC P-256 key');
  require(Object.keys(key).every(name => ['kty', 'crv', 'x', 'y', 'key_ops', 'ext', 'alg', 'use', 'kid'].includes(name)), 'Unexpected public key fields');
  for (const coordinate of [key.x, key.y]) {
    require(typeof coordinate === 'string' && /^[A-Za-z0-9_-]{43}$/.test(coordinate)
      && Buffer.from(coordinate, 'base64url').length === 32
      && Buffer.from(coordinate, 'base64url').toString('base64url') === coordinate, 'Invalid public key coordinates');
  }
  const pin = { kty: 'EC', crv: 'P-256', x: key.x as string, y: key.y as string };
  try { await webcrypto.subtle.importKey('jwk', pin, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
  catch { throw new Error('Invalid public key coordinates'); }
  return JSON.stringify(pin);
}

export async function prepareMainWebCandidate(options: {
  root?: string; repository: string; event: unknown | (() => unknown); publicKey?: string; api: CandidateApi;
}): Promise<MainWebPreparation> {
  const root = options.root ?? ROOT;
  const problems = webGpuReleaseProblems(root, 'web');
  if (problems.length) return { result: 'HELD', reason: 'release-gate', problems };
  require(statSync(join(root, 'shells/web/src/main.ts')).isFile(), 'Missing web release-gate source');
  require(REPOSITORY.test(options.repository), 'Invalid repository identity');
  const event = object(typeof options.event === 'function' ? options.event() : options.event);
  if (event.action !== 'completed' || object(event.repository).full_name !== options.repository || !runTrusted(event.workflow_run, options.repository)) {
    return { result: 'SKIPPED', reason: 'untrusted-trigger' };
  }
  const trigger = object(event.workflow_run);
  const source = trigger.head_sha as string, ciRun = String(trigger.id);
  const publicPin = await publicCandidatePin(options.publicKey);
  const base = `/repos/${options.repository}`;
  const verified = object(await options.api({ method: 'GET', path: `${base}/actions/runs/${ciRun}` }));
  if (!runTrusted(verified, options.repository) || verified.id !== trigger.id || verified.run_attempt !== trigger.run_attempt || verified.head_sha !== source) {
    return { result: 'SKIPPED', reason: 'unqualified-run' };
  }
  const main = object(await options.api({ method: 'GET', path: `${base}/git/ref/heads/main` }));
  if (main.ref !== 'refs/heads/main' || object(main.object).type !== 'commit' || object(main.object).sha !== source) {
    return { result: 'SKIPPED', reason: 'stale-main' };
  }
  const body = { ref: 'main', inputs: { build_images: 'true', release_scope: 'web', expected_source: source, ci_run: ciRun, public_key_jwk: publicPin } };
  require(Buffer.byteLength(JSON.stringify(body)) <= 2048, 'Candidate request exceeds its bound');
  await options.api({ method: 'POST', path: `${base}/actions/workflows/deployment-suse.yml/dispatches`, body });
  return { result: 'REQUESTED', source, ciRun };
}

/** The only write is the named candidate workflow dispatch; redirects are refused. */
export function githubCandidateApi(repository: string, token: string | undefined, requestFetch: typeof fetch = fetch): CandidateApi {
  return async request => {
    require(REPOSITORY.test(repository), 'Invalid repository identity');
    require(typeof token === 'string' && token.length > 0 && token.length <= 4096 && !/[\r\n]/.test(token), 'Missing GitHub API token');
    const base = `/repos/${repository}`;
    const get = request.method === 'GET' && (request.path === `${base}/git/ref/heads/main`
      || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/actions/runs/[1-9][0-9]{0,15}$`).test(request.path));
    const post = request.method === 'POST' && request.path === `${base}/actions/workflows/deployment-suse.yml/dispatches`;
    require((get && request.body === undefined) || (post && request.body !== undefined), 'Unowned GitHub API operation');
    const body = post ? JSON.stringify(request.body) : undefined;
    require(body === undefined || Buffer.byteLength(body) <= 2048, 'Candidate request exceeds its bound');
    let response: Response;
    try {
      response = await requestFetch(`https://api.github.com${request.path}`, { method: request.method, redirect: 'error',
        signal: AbortSignal.timeout(15000), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2026-03-10', ...(post ? { 'Content-Type': 'application/json' } : {}) }, body });
    } catch { throw new Error('GitHub API request failed or timed out'); }
    require(response.status === 200 || (post && response.status === 204), `GitHub API refused candidate request (HTTP ${response.status})`);
    if (post) { await response.body?.cancel(); return null; }
    const reader = response.body?.getReader();
    require(reader, 'Missing GitHub API response');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        require(size <= LIMIT, 'GitHub API response exceeds its bound'); chunks.push(part.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch { throw new Error('Invalid or oversized GitHub API response'); }
    finally { await reader.cancel(); reader.releaseLock(); }
  };
}

function eventFile(path: string | undefined): unknown {
  require(typeof path === 'string' && path.length > 0, 'Missing workflow event file');
  const fd = openSync(path, 'r');
  try {
    const bytes = Buffer.alloc(LIMIT + 1), count = readSync(fd, bytes, 0, bytes.length, 0);
    require(count <= LIMIT, 'Workflow event exceeds its bound');
    return JSON.parse(bytes.subarray(0, count).toString('utf8')) as unknown;
  } finally { closeSync(fd); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareMainWebCandidate({ repository: process.env.GITHUB_REPOSITORY ?? '',
      event: () => eventFile(process.env.GITHUB_EVENT_PATH), publicKey: process.env.LOLLY_RELEASE_PUBLIC_KEY_JWK,
      api: githubCandidateApi(process.env.GITHUB_REPOSITORY ?? '', process.env.GH_TOKEN) });
    console.log(JSON.stringify(result));
  } catch {
    console.error(JSON.stringify({ result: 'REFUSED', reason: 'Candidate preparation checks failed; no promotion was attempted' }));
    process.exitCode = 1;
  }
}
