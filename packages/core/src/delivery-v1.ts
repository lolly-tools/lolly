// SPDX-License-Identifier: MPL-2.0
/** Provider-neutral delivery rules. No network, filesystem or DOM dependencies. */
export type DeliveryClass = 'public-immutable' | 'public-revalidate' | 'public-bounded' | 'link' | 'instance-private' | 'person-private';
export interface CachePolicy {
  cacheControl: string;
  cdnCacheControl: string;
  surrogateControl?: string;
  vary?: 'Accept-Encoding';
  validator: 'strong' | 'weak';
  referrerPolicy?: 'no-referrer';
}
export interface CachePolicyOptions {
  signed?: boolean;
  boundedAgeSec?: number;
  status?: number;
  tokenBearing?: boolean;
}
const PRIVATE = 'private, no-store, max-age=0, no-transform';
function age(value: number | undefined, fallback: number, ceiling: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid delivery age');
  return Math.min(value, ceiling);
}
/** Unclassified responses and errors fail closed, including immutable-path errors. */
export function cachePolicy(cls: DeliveryClass, opts: CachePolicyOptions = {}): CachePolicy {
  let cacheControl = PRIVATE, cdnCacheControl = 'no-store';
  const status = opts.status ?? 200;
  if (status < 400) {
    switch (cls) {
      case 'public-immutable':
        if ([200, 206, 304].includes(status)) {
          cacheControl = 'public, max-age=31536000, s-maxage=31536000, immutable, no-transform';
          cdnCacheControl = 'max-age=31536000, no-transform';
        }
        break;
      case 'public-revalidate':
        cacheControl = 'public, max-age=0, s-maxage=0, must-revalidate, no-transform';
        cdnCacheControl = 'max-age=0, must-revalidate, no-transform';
        break;
      case 'public-bounded': {
        const a = age(opts.boundedAgeSec, 3600, 3600);
        const shared = opts.boundedAgeSec === undefined ? 86400 : a;
        const stale = opts.boundedAgeSec === undefined ? ', stale-while-revalidate=604800' : '';
        cacheControl = `public, max-age=${a}, s-maxage=${shared}${stale}, no-transform`;
        cdnCacheControl = `max-age=${shared}${stale}, no-transform`;
        break;
      }
      case 'link': cacheControl = `private, max-age=${age(opts.boundedAgeSec, 300, 300)}, no-transform`; break;
      case 'instance-private':
        cacheControl = opts.boundedAgeSec === undefined ? 'private, no-cache, no-transform' : `private, max-age=${age(opts.boundedAgeSec, 300, 300)}, no-transform`;
        break;
      case 'person-private': break;
      default: break;
    }
  }
  return {
    cacheControl, cdnCacheControl,
    // Fastly must not see an overriding public Surrogate-Control on a private response.
    ...(cacheControl.startsWith('public,') ? { surrogateControl: cdnCacheControl } : {}),
    validator: opts.signed && cls === 'public-bounded' ? 'weak' : 'strong',
    ...(opts.tokenBearing ? { referrerPolicy: 'no-referrer' as const } : {}),
  };
}

export type TagPrefix = 'x' | 'r' | 't' | 'e' | 'c' | 'a' | 'h' | 'u' | 'k' | 'p' | 'f' | 's' | 'b' | 'o' | 'y';
const PREFIXES = new Set<string>(['x', 'r', 't', 'e', 'c', 'a', 'h', 'u', 'k', 'p', 'f', 's', 'b', 'o', 'y']);
const TAG_VALUE = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;
export function tag(prefix: TagPrefix, value: string): string {
  const result = `${prefix}_${value}`;
  if (!PREFIXES.has(prefix) || !TAG_VALUE.test(value) || result.length > 80) throw new TypeError('Invalid delivery tag');
  return result;
}
export function renderTags(tags: string[], style: 'comma' | 'space'): string {
  if (style !== 'comma' && style !== 'space') throw new TypeError('Invalid tag style');
  if (tags.length > 12) throw new RangeError('Too many delivery tags');
  for (const value of tags) {
    if (value?.[1] !== '_' || tag(value[0] as TagPrefix, value.slice(2)) !== value) throw new TypeError('Invalid delivery tag');
  }
  const result = [...new Set(tags)].join(style === 'comma' ? ',' : ' ');
  if (result.length > 1000) throw new RangeError('Delivery tag header exceeds budget');
  return result;
}

export interface RenditionSpec { w?: number; h?: number; fit: 'inside' | 'cover'; format: 'png' | 'jpeg' | 'webp' | 'avif'; q?: number }
export interface RenditionDescriptor { of: string; spec: RenditionSpec }
export function renditionKey(spec: RenditionSpec): string {
  const parts: string[] = [];
  for (const [label, value] of [['w', spec.w], ['h', spec.h]] as const) {
    if (value !== undefined) {
      if (!Number.isSafeInteger(value) || value < 1 || value > 16384) throw new RangeError('Invalid rendition dimension');
      parts.push(`${label}${value}`);
    }
  }
  if (!parts.length || !['inside', 'cover'].includes(spec.fit) || !['png', 'jpeg', 'webp', 'avif'].includes(spec.format)) throw new TypeError('Invalid rendition specification');
  if (spec.fit === 'cover' && (spec.w === undefined || spec.h === undefined)) throw new TypeError('Cover requires both dimensions');
  parts.push(spec.fit, spec.format);
  if (spec.q !== undefined) {
    if (!Number.isSafeInteger(spec.q) || spec.q < 1 || spec.q > 100) throw new RangeError('Invalid rendition quality');
    parts.push(`q${spec.q}`);
  }
  return parts.join('.');
}
/** Insert the decoded-byte hash before the extension without introducing token URLs. */
export function contentAddressedPath(path: string, sha256: string): string {
  if (!/^[0-9a-f]{64}$/.test(sha256) || !canonicalDeliveryPath(path, /^\/[^?#]+$/)) throw new TypeError('Invalid content address');
  const dot = path.lastIndexOf('.');
  if (dot <= path.lastIndexOf('/') || !/^[a-z0-9]{1,16}$/i.test(path.slice(dot + 1))) throw new TypeError('Content address requires a file extension');
  return `${path.slice(0, dot)}.${sha256.slice(0, 16)}${path.slice(dot)}`;
}
/** Public OSS static trees only. Instances classify authorized bytes at the router. */
export function publicStaticDeliveryClass(path: string): DeliveryClass {
  if (!canonicalDeliveryPath(path, /^\/.*$/)) return 'person-private';
  if (path.startsWith('/_app/') || /^\/ort-hf\/[^/]+\//.test(path) ||
      /^\/info\/docs\.[a-z0-9_-]{6,40}\.(css|js)$/i.test(path) ||
      /^\/tools\/[a-z0-9-]+@[0-9a-f]{16}\//i.test(path) ||
      /^\/models\/.+@[0-9a-f]{16}\//.test(path) ||
      /\.[0-9a-f]{16}\.[a-z0-9]{1,16}$/i.test(path)) return 'public-immutable';
  return 'public-revalidate';
}

export type DeliveryCryptoKey = Parameters<typeof globalThis.crypto.subtle.sign>[1];
export interface DeliveryTokenClaims { v: 1; kid: string; exp: number; cls: 'link' | 'instance-private' | 'person-private' }
export interface DeliveryTokenContext { canonicalHost: string; subject?: string }
export interface DeliveryTokenVerifyContext extends DeliveryTokenContext { cls: DeliveryTokenClaims['cls']; pattern: RegExp; maxSkewSec: number }
/** Validate the unescaped route spelling, before URL normalization can erase attacks. */
export function canonicalDeliveryPath(path: string, pattern: RegExp): string | null {
  if (!path.startsWith('/') || path.includes('//') || /[%\\?#]/.test(path) || [...path].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) >= 127) || path.split('/').some(p => p === '.' || p === '..')) return null;
  // Strip stateful flags and require a full match, even for an unanchored caller regex.
  const match = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).exec(path);
  return match && match.index === 0 && match[0] === path ? path : null;
}
function validHost(host: string): boolean {
  if (!host || host !== host.toLowerCase() || /[|\s/?#@\\]/.test(host)) return false;
  try { return new URL(`https://${host}`).host === host; } catch { return false; }
}
function validContext(ctx: DeliveryTokenContext): boolean {
  return validHost(ctx.canonicalHost) && (ctx.subject === undefined || /^[0-9a-f]{64}$/.test(ctx.subject));
}
function validClaims(c: DeliveryTokenClaims): boolean {
  return c.v === 1 && /^[a-z0-9_-]{1,32}$/.test(c.kid) && Number.isSafeInteger(c.exp) && c.exp > 0 && ['link', 'instance-private', 'person-private'].includes(c.cls);
}
function tokenMessage(c: DeliveryTokenClaims, path: string, ctx: DeliveryTokenContext): ArrayBuffer {
  return new TextEncoder().encode(`lolly-dt1|${ctx.canonicalHost}|${path}|${c.exp}|${c.cls}${ctx.subject === undefined ? '' : `|${ctx.subject}`}`).buffer;
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function signDeliveryToken(c: DeliveryTokenClaims, path: string, ctx: DeliveryTokenContext, key: DeliveryCryptoKey): Promise<string> {
  if (!validClaims(c) || !validContext(ctx) || !canonicalDeliveryPath(path, /^\/.+$/)) throw new TypeError('Invalid delivery token scope');
  const signature = await crypto.subtle.sign('HMAC', key, tokenMessage(c, path, ctx));
  return `1.${c.kid}.${c.exp}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyDeliveryToken(token: string, path: string, ctx: DeliveryTokenVerifyContext, keys: Map<string, DeliveryCryptoKey>, now: number): Promise<'ok' | 'expired' | 'bad' | 'scope'> {
  if (!validContext(ctx) || !canonicalDeliveryPath(path, ctx.pattern) || !['link', 'instance-private', 'person-private'].includes(ctx.cls)) return 'scope';
  if (!Number.isFinite(now) || !Number.isSafeInteger(ctx.maxSkewSec) || ctx.maxSkewSec < 0 || ctx.maxSkewSec > 60) return 'bad';
  const match = /^1\.([a-z0-9_-]{1,32})\.([1-9][0-9]{0,15})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return 'bad';
  const c: DeliveryTokenClaims = { v: 1, kid: match[1]!, exp: Number(match[2]), cls: ctx.cls };
  const key = keys.get(c.kid);
  if (!validClaims(c) || !key) return 'bad';
  try {
    const raw = Uint8Array.from(atob(match[3]!.replace(/-/g, '+').replace(/_/g, '/') + '='), ch => ch.charCodeAt(0));
    // Reject noncanonical base64 padding bits; WebCrypto performs constant-time MAC verification.
    if (base64url(raw) !== match[3] || !await crypto.subtle.verify('HMAC', key, raw.buffer, tokenMessage(c, path, ctx))) return 'bad';
    return now >= c.exp + ctx.maxSkewSec ? 'expired' : 'ok';
  } catch { return 'bad'; }
}
