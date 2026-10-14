// SPDX-License-Identifier: MPL-2.0
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) blocked.addSubnet(network, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export type HostResolver = (hostname: string) => Promise<string[]>;

/** Ordinary public unicast addresses, excluding special-purpose ranges. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && !address.includes('%') && globalV6.check(address, 'ipv6')
    && !blocked.check(address, 'ipv6');
}

export const PUBLIC_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/avif', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon',
  'image/tiff', 'image/apng', 'image/jxl', 'image/heic', 'image/heif',
  'image/x-exr', 'image/vnd.radiance',
]);
export const MAX_PUBLIC_ASSET_BYTES = 25 * 1024 * 1024;

type RefusalCode = 'refused' | 'redirect' | 'status' | 'type' | 'size' | 'timeout' | 'encoding';
export class PublicHttpError extends Error {
  readonly code: RefusalCode;
  constructor(code: RefusalCode, message: string) { super(message); this.code = code; }
}

export function assertPublicHttpShape(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new PublicHttpError('refused', 'Only http(s) URLs are supported.');
  if (url.username || url.password) throw new PublicHttpError('refused', 'The URL must not carry a username or password.');
  if (url.toString().length > 8192) throw new PublicHttpError('refused', 'The URL is too long.');
}

export interface PublicHttpRequestOptions {
  address: string;
  signal: AbortSignal;
  headers: Headers;
}
export type PublicHttpRequest = (url: URL, options: PublicHttpRequestOptions) => Promise<Response>;

/** Connect to the checked address while preserving the original Host and TLS name. */
export const requestPinned: PublicHttpRequest = (url, { address, signal, headers }) => new Promise((resolve, reject) => {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const req = send({
    protocol: url.protocol,
    hostname: address,
    family: isIP(address),
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    agent: false,
    signal,
    ...(url.protocol === 'https:' && !isIP(hostname) ? { servername: hostname } : {}),
    headers: { ...Object.fromEntries(headers), host: url.host, 'accept-encoding': 'identity' },
    maxHeaderSize: 16 * 1024,
  }, res => {
    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(res.headers)) {
      if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item);
      else if (value !== undefined) responseHeaders.set(name, value);
    }
    const status = res.statusCode ?? 502;
    if ([204, 205, 304].includes(status)) {
      res.destroy();
      resolve(new Response(null, { status, headers: responseHeaders }));
    } else {
      resolve(new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status, headers: responseHeaders }));
    }
  });
  req.once('error', reject);
  req.once('upgrade', (_res, socket) => { socket.destroy(); reject(new PublicHttpError('status', 'Protocol upgrades are not supported.')); });
  req.end();
});

async function resolveHost(hostname: string): Promise<string[]> {
  try { return (await lookup(hostname, { all: true, verbatim: true })).map(answer => answer.address); }
  catch { return []; }
}

function withinDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = (): void => { reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function checkedAddress(url: URL, resolver: HostResolver, signal: AbortSignal): Promise<string> {
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(literal) ? [literal] : await withinDeadline(resolver(url.hostname), signal);
  if (!addresses.length || addresses.some(address => !isPublicAddress(address))) {
    throw new PublicHttpError('refused', 'That address is not reachable from here.');
  }
  return addresses.find(address => isIP(address) === 4) ?? addresses[0]!;
}

async function cancel(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* Response is already closed. */ }
}

export async function readCappedResponse(response: Response, max: number, signal?: AbortSignal): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    await cancel(response);
    throw new PublicHttpError('size', `The response exceeds the ${max}-byte limit.`);
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = reader.read();
      const { done, value } = signal ? await withinDeadline(next, signal) : await next;
      if (done) break;
      total += value.byteLength;
      if (total > max) throw new PublicHttpError('size', `The response exceeds the ${max}-byte limit.`);
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export interface PublicHttpOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowedTypes?: ReadonlySet<string>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  resolver?: HostResolver;
  request?: PublicHttpRequest;
  allowUrl?: (url: URL) => boolean;
  onResponse?: (url: URL, response: Response) => void;
}

/** One deadline covers DNS, every redirect, and the counting body read. */
export async function fetchPublicBytes(raw: string | URL, opts: PublicHttpOptions = {}): Promise<{ bytes: Uint8Array; mime: string; response: Response; url: URL }> {
  const controller = new AbortController();
  const abort = (): void => { controller.abort(opts.signal?.reason); };
  if (opts.signal?.aborted) abort();
  else opts.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new PublicHttpError('timeout', 'That address took too long to answer.')), opts.timeoutMs ?? 20_000);
  const signal = controller.signal;
  try {
    let url = new URL(raw);
    const headers = new Headers(opts.headers);
    for (let hop = 0; ; hop++) {
      signal.throwIfAborted();
      assertPublicHttpShape(url);
      if (opts.allowUrl && !opts.allowUrl(url)) throw new PublicHttpError('refused', 'That URL is not allowed here.');
      const address = await checkedAddress(url, opts.resolver ?? resolveHost, signal);
      const response = await withinDeadline((opts.request ?? requestPinned)(url, { address, signal, headers }), signal);
      try { opts.onResponse?.(url, response); } catch (error) { await cancel(response); throw error; }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await cancel(response);
        if (!location) throw new PublicHttpError('redirect', 'That address returned a redirect without a location.');
        if (hop >= (opts.maxRedirects ?? 4)) throw new PublicHttpError('redirect', 'That address redirected too many times.');
        try { url = new URL(location, url); } catch { throw new PublicHttpError('redirect', 'That address redirected to an invalid location.'); }
        continue;
      }
      if (!response.ok) { await cancel(response); throw new PublicHttpError('status', `That address answered with ${response.status}.`); }
      const mime = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (opts.allowedTypes && !opts.allowedTypes.has(mime)) { await cancel(response); throw new PublicHttpError('type', 'That URL has an unsupported content type.'); }
      if ((response.headers.get('content-encoding') ?? 'identity').toLowerCase() !== 'identity') {
        await cancel(response); throw new PublicHttpError('encoding', 'That address returned unsupported content encoding.');
      }
      const bytes = await readCappedResponse(response, opts.maxBytes ?? MAX_PUBLIC_ASSET_BYTES, signal);
      return { bytes, mime, response, url };
    }
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
