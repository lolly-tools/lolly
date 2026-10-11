// SPDX-License-Identifier: MPL-2.0
/** Origin-only content coding. Intermediaries may never rewrite decoded bytes. */
import { brotliCompressSync, gzipSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { cachePolicy, type DeliveryClass } from '../../../packages/core/src/delivery-v1.ts';

export function deliveryHeaders(cls: DeliveryClass, options: Parameters<typeof cachePolicy>[1] = {}): Record<string, string> {
  const policy = cachePolicy(cls, options);
  return { 'cache-control': policy.cacheControl, 'cdn-cache-control': policy.cdnCacheControl,
    ...(policy.referrerPolicy ? { 'referrer-policy': policy.referrerPolicy } : {}) };
}

/** Highest advertised quality wins; identity stays available unless refused. */
function qualities(header: string): Map<string, number> {
  const quality = new Map<string, number>();
  for (const item of header.split(',')) {
    const [name, ...params] = item.trim().toLowerCase().split(';');
    if (!name || quality.has(name)) continue;
    const q = params.find(p => p.trim().startsWith('q='));
    const raw = q?.trim().slice(2);
    const value = raw === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0;
    quality.set(name, value);
  }
  return quality;
}
export function contentCoding(header: string | undefined): 'br' | 'gzip' | 'identity' | null {
  if (!header) return 'identity';
  const quality = qualities(header);
  const br = quality.get('br') ?? quality.get('*') ?? 0;
  const gzip = quality.get('gzip') ?? quality.get('*') ?? 0;
  if ((quality.get('identity') ?? 0) > Math.max(br, gzip)) return 'identity';
  if (br > 0 && br >= gzip) return 'br';
  if (gzip > 0) return 'gzip';
  return (quality.get('identity') ?? (quality.get('*') === 0 ? 0 : 1)) > 0 ? 'identity' : null;
}

function identityAllowed(header: string | undefined): boolean {
  const quality = qualities(header ?? '');
  return (quality.get('identity') ?? (quality.get('*') === 0 ? 0 : 1)) > 0;
}

const textType = (type: string): boolean => /^(?:text\/|application\/(?:[^;]*\+)?(?:json|xml|javascript)(?:;|$)|image\/svg\+xml)/i.test(type);

/** Wrap the gateway's finite writeHead/end responses. Default/error policy is
 * private, including OAuth failures and branches that forgot their class. The
 * gateway meters decoded response bytes: coding cannot bypass its daily ceiling.
 * A compressed representation carries a weak validator over the decoded bytes;
 * it never promises byte-for-byte equality with the identity representation. */
export function deliveryResponse(req: IncomingMessage, target: ServerResponse): ServerResponse {
  let status = 200;
  let headers: Record<string, string> = {};
  let ended = false;
  const accept = typeof req.headers['accept-encoding'] === 'string' ? req.headers['accept-encoding'] : undefined;
  const response = new Proxy(target, { get(object, name) {
    if (name === 'writeHead') return (code: number, supplied: Record<string, string> = {}) => {
      status = code;
      headers = Object.fromEntries(Object.entries(supplied).map(([key, value]) => [key.toLowerCase(), String(value)]));
      return response;
    };
    if (name === 'end') return (body?: string | Uint8Array) => {
      if (ended) return target;
      ended = true;
      headers = { ...deliveryHeaders('person-private', { tokenBearing: true }), ...headers };
      if (/(?:^|,)\s*no-store\s*(?:,|$)/i.test(headers['cache-control'] ?? '')) Object.assign(headers, deliveryHeaders('person-private', { tokenBearing: true }));
      if (status >= 400) Object.assign(headers, deliveryHeaders('person-private', { status, tokenBearing: true }));
      const empty = req.method === 'HEAD' || status === 204 || status === 304;
      let bytes = body === undefined ? undefined : Buffer.from(body);
      const coding = contentCoding(accept);
      if (textType(headers['content-type'] ?? '')) headers.vary = 'Accept-Encoding';
      if (!empty && bytes && !headers['content-encoding'] && textType(headers['content-type'] ?? '')) {
        if (coding === null) {
          status = 406;
          headers = { ...headers, ...deliveryHeaders('person-private', { status: 406 }), 'content-type': 'application/json; charset=utf-8' };
          bytes = Buffer.from('{"error":"No acceptable content encoding."}');
          delete headers.etag;
        } else if (coding !== 'identity' && (bytes.byteLength > 1024 || !identityAllowed(accept))) {
          bytes = coding === 'br' ? brotliCompressSync(bytes) : gzipSync(bytes);
          headers['content-encoding'] = coding;
          if (headers.etag && !headers.etag.startsWith('W/')) headers.etag = `W/${headers.etag}`;
        }
      }
      if (status === 304 && headers.etag && String(req.headers['if-none-match'] ?? '').includes(`W/${headers.etag}`)) headers.etag = `W/${headers.etag}`;
      if (empty) { delete headers['content-encoding']; delete headers['content-length']; }
      else if (bytes) headers['content-length'] = String(bytes.byteLength);
      target.writeHead(status, headers);
      target.end(empty ? undefined : bytes);
      return target;
    };
    const value = Reflect.get(object, name, object);
    return typeof value === 'function' ? value.bind(object) : value;
  } });
  return response;
}
