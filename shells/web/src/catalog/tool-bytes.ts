// SPDX-License-Identifier: MPL-2.0
import type { CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';
import { getToolIntegrity, catalogVerificationRequired, getCatalogSnapshot } from './integrity.ts';
import { instancePath, instanceFetch } from '../lib/instance.ts';

const MAX_BYTES = 32 * 1024 * 1024;
export interface ToolByteIO {
  fetch: typeof fetch;
  envelope: () => Promise<CatalogSignatureEnvelope | null>;
  root: () => string;
  base: () => string;
}
export function protectedPath(path: string): boolean {
  for (let round = 0; round < 5; round++) {
    const normalized = path.replace(/\/+/g, '/');
    if (/^\/(?:tools\/|catalog\/(?:previews|og)\/|info\/shots\/)/.test(normalized)) return true;
    try { const decoded = decodeURIComponent(path); if (decoded === path) return false; path = decoded; }
    catch { return false; }
  }
  return false;
}
function logicalPath(address: URL, root: URL): string {
  const prefix = root.pathname.replace(/\/tools\/?$/, '');
  return prefix && address.pathname.startsWith(prefix + '/') ? address.pathname.slice(prefix.length) : address.pathname;
}
export function catalogResourceAddress(raw: string): URL {
  const qualified = raw.startsWith('/') && !raw.startsWith('//') && protectedPath(raw) ? instancePath(raw) : raw;
  return new URL(qualified, globalThis.location?.href ?? 'https://lolly.tools/');
}
export function isCatalogResourceURL(raw: string): boolean {
  const address = catalogResourceAddress(raw), root = new URL(instancePath('/tools/'), globalThis.location?.href ?? 'https://lolly.tools/');
  return address.origin === root.origin && protectedPath(logicalPath(address, root));
}
export function signedToolLeaf(raw: string, envelope: CatalogSignatureEnvelope, root: string, base: string): { id: string; file: string } | null {
  const address = new URL(raw, base), origin = new URL(root, base);
  if (address.origin !== origin.origin) return null;
  const match = logicalPath(address, origin).match(/^\/tools\/([a-z0-9][a-z0-9-]*)(?:@([0-9a-f]{16}))?\/(.+)$/i);
  if (!match) return null;
  const [, id, revision, file] = match;
  if (!id || !file || /[%\\?#]/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('The tool resource path is invalid.');
  if (revision && revision !== envelope.toolDirs?.[id]?.slice(0, 16)) throw new Error('The tool resource belongs to a different catalog revision.');
  if (!envelope.files[`${id}/${file}`]) throw new Error('The tool resource is absent from the accepted catalog.');
  return { id, file };
}
async function boundedBytes(response: Response): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`The tool resource could not be read (${response.status}).`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('The tool resource exceeds the 32 MiB read limit.'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The tool resource has no readable body.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      length += item.value.byteLength;
      if (length > MAX_BYTES) throw new Error('The tool resource exceeds the 32 MiB read limit.');
      chunks.push(item.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function createVerifiedToolFetch(io: ToolByteIO): typeof fetch {
  let active = 0;
  return async (source, init) => {
    const raw = source instanceof Request ? source.url : String(source);
    const root = new URL(io.root(), io.base());
    const prefix = root.pathname.replace(/\/tools\/?$/, '');
    const url = raw.startsWith('/') && !raw.startsWith('//') && protectedPath(raw) ? new URL(prefix + raw, root.origin) : new URL(raw, io.base());
    const path = logicalPath(url, root);
    const publicResource = /^\/(?:catalog\/(?:previews|og)|info\/shots)\//.test(path);
    if (url.origin !== new URL(io.root(), io.base()).origin || !protectedPath(path)) return io.fetch(source, init);
    if (/[%\\]/.test(url.pathname) || url.pathname.includes('//')) throw new Error('The signed resource address must use its canonical path.');
    const envelope = await io.envelope();
    if (!envelope) return io.fetch(source, init);
    const leaf = signedToolLeaf(url.href, envelope, io.root(), io.base());
    const resourceHash = publicResource ? envelope.resources?.[path] : undefined;
    if (!leaf && !resourceHash) throw new Error('The resource has no accepted byte identity.');
    const method = (init?.method ?? (source instanceof Request ? source.method : 'GET')).toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') throw new Error('Signed tool resources support reads only.');
    if (active >= 8) throw new Error('Signed resource reads are busy. Try again shortly.');
    active++;
    try {
      const requestSignal = init?.signal ?? (source instanceof Request ? source.signal : undefined);
      const signal = requestSignal ? AbortSignal.any([requestSignal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
      const response = await io.fetch(source instanceof Request ? new Request(new Request(url, source), { method: 'GET', redirect: 'error' }) : url.href, { ...init, method: 'GET', redirect: 'error', signal });
      if (signal.aborted) { await response.body?.cancel(); throw new Error('The signed resource read timed out.'); }
      const bytes = await boundedBytes(response);
      const { verifyToolFile, sha256Hex } = await import('../../../../engine/src/catalog-integrity.ts');
      const accepted = leaf ? (await verifyToolFile(envelope, leaf.id, leaf.file, bytes)).ok : await sha256Hex(bytes) === resourceHash;
      if (!accepted) throw new Error('The tool resource does not match the accepted catalog.');
      const headers = new Headers(response.headers);
      headers.delete('content-encoding'); headers.delete('content-length');
      headers.set('content-length', String(bytes.length));
      const checked = new Response(method === 'HEAD' ? null : bytes.slice().buffer, { status: response.status, statusText: response.statusText, headers });
      Object.defineProperty(checked, 'url', { value: response.url || url.href });
      return checked;
    } finally { active--; }
  };
}
let resourceFallback: typeof fetch | undefined;
function instanceResourceFetch(source: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const url = source instanceof Request ? source.url : source;
  const request = source instanceof Request ? { headers: source.headers, credentials: source.credentials, cache: source.cache, signal: source.signal, ...init } : init;
  return instanceFetch(url, request, { timeoutMs: 15000, maxResponseBytes: MAX_BYTES, fallbackFetch: resourceFallback ?? globalThis.fetch.bind(globalThis) });
}
const guards = new WeakSet<typeof fetch>();
/** Install before any verified template can create a library loader. */
export function installToolByteVerification(): void {
  if (!catalogVerificationRequired() || guards.has(globalThis.fetch)) return;
  const fallback = globalThis.fetch.bind(globalThis);
  resourceFallback = fallback;
  const guarded = createVerifiedToolFetch({ fetch: (source, init) => isCatalogResourceURL(source instanceof Request ? source.url : String(source)) ? instanceResourceFetch(source, init) : fallback(source, init),
    envelope: async () => { const accepted = await getToolIntegrity(); if (!accepted) throw new Error('The resource has no verified catalog identity.'); return accepted.envelope; },
    root: () => instancePath('/tools/'), base: () => globalThis.location?.href ?? 'https://lolly.tools/' });
  guards.add(guarded); globalThis.fetch = guarded;
}

const objectURLs = new Map<string, Promise<string>>();
let objectBytes = 0;
const resourceDependencies = new Map<string, Set<string>>();
function reaches(start: string, target: string, seen = new Set<string>()): boolean {
  if (start === target) return true;
  if (seen.has(start)) return false;
  if (seen.size > 4096) throw new Error('The preview dependency graph exceeds its limit.');
  seen.add(start);
  return [...(resourceDependencies.get(start) ?? [])].some(next => reaches(next, target, seen));
}
/** A DOM resource receives verified bytes through a blob URL, never a second network read. */
export async function verifiedResourceURL(raw: string): Promise<string> {
  return resourceURL(raw, new Set());
}
async function resourceURL(raw: string, ancestors: Set<string>): Promise<string> {
  if (!catalogVerificationRequired() || /^(?:blob:|data:)/i.test(raw)) return raw;
  const integrity = await getToolIntegrity();
  if (!integrity) throw new Error('The resource has no accepted catalog identity.');
  const absolute = catalogResourceAddress(raw).href;
  if (ancestors.has(absolute) || ancestors.size >= 8) throw new Error('The preview resource graph is cyclic or too deep.');
  const chain = new Set(ancestors); chain.add(absolute);
  const key = `${integrity.envelope.signature}:${absolute}`;
  const parent = [...ancestors].at(-1);
  if (parent) {
    const parentKey = `${integrity.envelope.signature}:${parent}`;
    if (reaches(key, parentKey)) throw new Error('The preview resource graph is cyclic.');
    const children = resourceDependencies.get(parentKey) ?? new Set<string>();
    children.add(key); resourceDependencies.set(parentKey, children);
  }
  if (objectURLs.has(key)) return objectURLs.get(key)!;
  if (objectURLs.size >= 512) throw new Error('The verified preview cache is full. Reload when your work is saved.');
  const pending = (async () => {
    const base = globalThis.location?.href ?? 'https://lolly.tools/';
    const leaf = signedToolLeaf(absolute, integrity.envelope, instancePath('/tools/'), base);
    let bytes: Uint8Array, mime: string;
    if (leaf || integrity.envelope.resources?.[logicalPath(new URL(absolute), new URL(instancePath('/tools/'), base))]) {
      const guarded = createVerifiedToolFetch({ fetch: instanceResourceFetch, envelope: async () => integrity.envelope, root: () => instancePath('/tools/'), base: () => base });
      const response = await guarded(absolute); bytes = new Uint8Array(await response.arrayBuffer()); mime = response.headers.get('content-type') ?? '';
    } else {
      const snapshot = await getCatalogSnapshot();
      if (!snapshot?.assetText || !snapshot.envelope.assetIndexHash) throw new Error('The preview resource is absent from the signed asset catalog.');
      const index = JSON.parse(snapshot.assetText) as { assets: { formats?: { url: string; checksum?: string; mime?: string }[]; locales?: Record<string, { url: string; checksum?: string; mime?: string }[]> }[] };
      const format = index.assets.flatMap(asset => [...(asset.formats ?? []), ...Object.values(asset.locales ?? {}).flat()])
        .find(format => new URL(instancePath(format.url), base).href === absolute);
      if (!format?.checksum) throw new Error('The preview resource has no signed byte checksum.');
      const response = await instanceResourceFetch(absolute, { redirect: 'error', signal: AbortSignal.timeout(15000) }); bytes = await boundedBytes(response); mime = format.mime ?? response.headers.get('content-type') ?? '';
      const { sha256Hex } = await import('../../../../engine/src/catalog-integrity.ts');
      const actual = await sha256Hex(bytes);
      const expected = `sha256-${btoa(String.fromCharCode(...Uint8Array.from(actual.match(/../g)!, pair => parseInt(pair, 16))))}`;
      if (expected !== format.checksum) throw new Error('The preview resource does not match its signed checksum.');
    }
    const extension = new URL(absolute).pathname.split('.').pop()?.toLowerCase();
    if (extension === 'html' || extension === 'svg' || extension === 'css') {
      const text = await inlineVerifiedReferences(new TextDecoder('utf-8', { fatal: true }).decode(bytes), absolute, chain);
      bytes = new TextEncoder().encode(text);
      mime = extension === 'svg' ? 'image/svg+xml' : extension === 'css' ? 'text/css' : 'text/html';
    }
    if (objectBytes + bytes.byteLength > 128 * 1024 * 1024) throw new Error('The verified preview cache exceeds its byte limit. Reload when your work is saved.');
    objectBytes += bytes.byteLength;
    return URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime.split(';')[0] || 'application/octet-stream' }));
  })();
  objectURLs.set(key, pending);
  try { return await pending; } catch (error) { objectURLs.delete(key); throw error; }
  finally { resourceDependencies.delete(key); }
}
async function inlineVerifiedReferences(text: string, base: string, ancestors: Set<string>): Promise<string> {
  const references = [...text.matchAll(/(?:\b(?:src|href|poster)\s*=\s*["']|url\(\s*["']?|@import\s*["'])([^"'\s)<>]+)/gi)]
    .map(match => match[1]!).filter(raw => !/^(?:data:|blob:|#)/i.test(raw));
  if (references.length > 64) throw new Error('The preview contains too many linked resources.');
  for (const raw of new Set(references)) {
    const url = await resourceURL(new URL(raw, base).href, ancestors);
    text = text.split(raw).join(url);
  }
  if (/<(?:script|iframe|object|embed|base)\b|\bsrcset\s*=|\bimage-set\s*\(/i.test(text)) throw new Error('The preview requires an unsupported active resource.');
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data: blob:; style-src &#39;unsafe-inline&#39; blob:; font-src data: blob:; media-src data: blob:;">';
  return /<html\b/i.test(text) ? text.replace(/<head(?:\s[^>]*)?>/i, opening => opening + csp) : text;
}


/** Resolve complete signed child references before a template parser can start network reads. */
export async function resolveVerifiedStaticResources(text: string, envelope: CatalogSignatureEnvelope, read: (url: string) => Promise<string> = verifiedResourceURL): Promise<string> {
  const references = [...text.matchAll(/(?<![a-z0-9._/:-])(?:https?:\/\/[^/\s"'`<>]+)?(?:\/[a-z0-9_.~%@+-]+)*\/tools\/[a-z0-9][a-z0-9-]*(?:@[0-9a-f]{16})?\/[^\s"'`(){}<>]+/gi)].map(match => match[0]);
  const selected = new Set<string>();
  const base = globalThis.location?.href ?? 'https://lolly.tools/';
  for (const raw of references) {
    const address = new URL(raw, base);
    const match = logicalPath(address, new URL(instancePath('/tools/'), base)).match(/^\/tools\/([a-z0-9][a-z0-9-]*)(?:@[0-9a-f]{16})?\/(.+)$/i);
    if (address.origin !== new URL(instancePath('/tools/'), base).origin || !match) continue;
    if (envelope.files[`${match[1]}/${match[2]}`]) selected.add(raw);
    else if (/\.[a-z0-9]+$/i.test(match[2]!) && !/[${}]/.test(match[2]!)) throw new Error('A static tool resource is absent from the accepted catalog.');
  }
  if (selected.size > 64) throw new Error('The tool source contains too many static child resources.');
  for (const raw of selected) {
    const fragment = new URL(raw, base).hash;
    const url = await read(raw);
    text = text.split(raw).join(url + fragment);
  }
  return text;
}
