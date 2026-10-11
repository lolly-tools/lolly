// SPDX-License-Identifier: MPL-2.0
/** Exact-byte, bearer-bound results. One gateway process owns this directory. */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeFileName } from '@lolly-tools/core/file-v1';
import { signDeliveryToken, verifyDeliveryToken } from '../../../packages/core/src/delivery-v1.ts';
import type { ContentBlock, ToolCallResult } from './protocol.ts';

export const RESULT_LINK_THRESHOLD = 1024 * 1024;
const RESULT_TTL_SEC = 300;
const OWNER_LIMIT = 64 * 1024 * 1024;
const GLOBAL_LIMIT = 256 * 1024 * 1024;
const ENTRY_LIMIT = 200;
const PATH_PATTERN = /^\/api\/mcp\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Entry = { owner: string; path: string; file: string; expires: number; size: number; sha256: string; mime: string; name: string };
export type HoldResult = (bytes: Uint8Array, mime: string, name: string) => Promise<ContentBlock>;

/** Scope is the validated bearer, never an invented header on an open server. */
export function bearerPrincipal(header: string | undefined): string | null {
  const bearer = /^Bearer\s+(.+)$/i.exec(header ?? '')?.[1]?.trim();
  return bearer ? createHash('sha256').update(bearer).digest('hex') : null;
}

export function privateFileScopeEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.LOLLY_MCP_PRIVATE_FILES === '1' && !!env.LOLLY_MCP_TOKEN?.trim() && !env.VERCEL
    && (env.LOLLY_MCP_REPLICAS === undefined || env.LOLLY_MCP_REPLICAS === '1');
}

export class ResultFiles {
  private directory?: Promise<string>;
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, number>();
  private pendingCount = 0;
  private closed = false;
  private readonly expiryTimer: ReturnType<typeof setInterval>;
  private readonly now: () => number;
  private readonly lifetimeSeconds: number;
  constructor(now: () => number = Date.now, lifetimeSeconds = RESULT_TTL_SEC) {
    if (!Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds > RESULT_TTL_SEC) throw new Error('Result lifetime must be an integer from 1 to 300 seconds.');
    this.now = now;
    this.lifetimeSeconds = lifetimeSeconds;
    this.expiryTimer = setInterval(() => { void this.prune().catch(() => {}); }, 30_000);
    this.expiryTimer.unref();
  }
  private async prune(): Promise<void> {
    for (const [id, entry] of this.entries) if (entry.expires <= Math.floor(this.now() / 1000)) {
      this.entries.delete(id); await unlink(entry.file).catch(() => {});
    }
  }
  private reserve(owner: string, size: number): () => void {
    const entries = [...this.entries.values()];
    const own = entries.filter(entry => entry.owner === owner).reduce((sum, entry) => sum + entry.size, 0) + (this.pending.get(owner) ?? 0);
    const total = entries.reduce((sum, entry) => sum + entry.size, 0) + [...this.pending.values()].reduce((a, b) => a + b, 0);
    if (this.closed || !owner || !Number.isSafeInteger(size) || size <= 0 || size > OWNER_LIMIT || own + size > OWNER_LIMIT || total + size > GLOBAL_LIMIT || entries.length + this.pendingCount >= ENTRY_LIMIT) throw new Error('Private result quota reached. Download existing results or wait five minutes.');
    this.pendingCount++; this.pending.set(owner, (this.pending.get(owner) ?? 0) + size);
    return () => { this.pendingCount--; const left = (this.pending.get(owner) ?? 0) - size; if (left) this.pending.set(owner, left); else this.pending.delete(owner); };
  }
  private async key(host: string, secret: string): Promise<CryptoKey> {
    if (!secret) throw new Error('Private result signing is not configured.');
    const key = createHmac('sha256', secret).update(`edge-token:mcp1:${host}:person-private`).digest();
    return crypto.subtle.importKey('raw', Uint8Array.from(key).buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }
  async hold(owner: string, bytes: Uint8Array, mime: string, name: string, origin: string, secret: string): Promise<ContentBlock> {
    await this.prune();
    const release = this.reserve(owner, bytes.byteLength);
    const id = randomUUID(); const path = `/api/mcp/files/${id}`;
    let file: string | undefined;
    try {
      const base = new URL(origin); const expires = Math.floor(this.now() / 1000) + this.lifetimeSeconds;
      this.directory ??= mkdtemp(join(tmpdir(), 'lolly-mcp-results-'));
      file = join(await this.directory, id);
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      const digest = createHash('sha256').update(bytes).digest('hex');
      const dt = await signDeliveryToken({ v: 1, kid: 'mcp1', exp: expires, cls: 'person-private' }, path, { canonicalHost: base.host, subject: owner }, await this.key(base.host, secret));
      const filename = safeFileName(name);
      this.entries.set(id, { owner, path, file, expires, size: bytes.byteLength, sha256: digest, mime: /^[\w.+-]+\/[\w.+-]+(?:;[\x20-\x7e]*)?$/.test(mime) ? mime : 'application/octet-stream', name: filename });
      return { type: 'resource_link', uri: `${base.origin}${path}?dt=${encodeURIComponent(dt)}`, name: filename, mimeType: mime,
        size: bytes.byteLength, description: 'Private result. Fetch with this same MCP bearer within five minutes. Download a copy before it expires.' };
    } catch (error) { if (file) await unlink(file).catch(() => {}); throw error; }
    finally { release(); }
  }
  async fetch(owner: string, path: string, token: string, origin: string, secret: string): Promise<{ bytes: Uint8Array; mime: string; name: string; etag: string } | null> {
    await this.prune();
    if (!PATH_PATTERN.test(path) || !owner || this.closed) return null;
    const entry = this.entries.get(path.slice(path.lastIndexOf('/') + 1));
    if (!entry || entry.owner !== owner || entry.path !== path) return null;
    const host = new URL(origin).host;
    const status = await verifyDeliveryToken(token, path, { canonicalHost: host, cls: 'person-private', pattern: PATH_PATTERN, subject: owner, maxSkewSec: 0 }, new Map([['mcp1', await this.key(host, secret)]]), Math.floor(this.now() / 1000));
    if (status !== 'ok') return null;
    const bytes = await readFile(entry.file);
    if (bytes.byteLength !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Private result integrity check failed.');
    // A read that crosses expiry must not return bytes after the grant ended.
    if (entry.expires <= Math.floor(this.now() / 1000)) return null;
    return { bytes, mime: entry.mime, name: entry.name, etag: `"${entry.sha256}"` };
  }
  async close(): Promise<void> {
    this.closed = true;
    clearInterval(this.expiryTimer);
    if (this.directory) await rm(await this.directory, { recursive: true, force: true });
    this.entries.clear();
  }
}

/** Other tool implementations may still return embedded content. Keep their
 * metadata and replace only oversized exact byte payloads, never text guidance. */
export async function linkLargeResults(result: ToolCallResult, hold?: HoldResult): Promise<ToolCallResult> {
  if (!hold) return result;
  const content: ContentBlock[] = [];
  for (const block of result.content) {
    if (block.type === 'image' && block.data.length > Math.floor(RESULT_LINK_THRESHOLD / 3) * 4) {
      const bytes = Buffer.from(block.data, 'base64');
      content.push(bytes.byteLength > RESULT_LINK_THRESHOLD ? await hold(bytes, block.mimeType, 'result') : block);
    } else if (block.type === 'resource' && (block.resource.blob || block.resource.text)) {
      const bytes = block.resource.blob ? Buffer.from(block.resource.blob, 'base64') : Buffer.from(block.resource.text!, 'utf8');
      if (bytes.byteLength > RESULT_LINK_THRESHOLD) content.push(await hold(bytes, block.resource.mimeType ?? 'application/octet-stream', block.resource.uri.split('/').pop()?.split('?')[0] || 'result'));
      else content.push(block);
    } else content.push(block);
  }
  return { ...result, content };
}

export const resultFiles = new ResultFiles();
