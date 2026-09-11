// SPDX-License-Identifier: MPL-2.0
/**
 * HMAC-signed values: the stateless backbone of the OAuth authorization server
 * (oauth.ts). A value is `base64url(JSON payload) + '.' + base64url(HMAC-SHA256(
 * payloadB64, secret))`; verification needs only the secret, so the service keeps
 * NO session/token store. This mirrors `services/ca/lib/tokens.mjs` deliberately,
 * but is re-implemented here (not imported) so `services/mcp` stays self-contained
 * for the eventual repo split (see README).
 *
 * Every payload carries a short `t` (type) tag for domain separation. An auth
 * code can never be replayed where an access token is expected, even though both
 * share one secret.
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

const bytesToB64u = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const b64uToBytes = (str: string): Uint8Array => new Uint8Array(Buffer.from(String(str), 'base64url'));

/** n random bytes as base64url - for client ids, nonces, opaque handles. */
export const randomB64u = (n = 32): string => bytesToB64u(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hmac(secret: string, text: string): Promise<Uint8Array> {
  if (!secret) throw new Error('signing secret is not set');
  const key = await subtle.importKey('raw', te.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', key, te.encode(text)));
}

/** SHA-256(text) as base64url - used to verify a PKCE S256 code_challenge. */
export async function sha256B64u(text: string): Promise<string> {
  return bytesToB64u(new Uint8Array(await subtle.digest('SHA-256', te.encode(text))));
}

/** Sign a JSON-able payload → 'payloadB64.macB64'. */
export async function signValue(payload: unknown, secret: string): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${bytesToB64u(await hmac(secret, body))}`;
}

/** Verify + decode a signed value → payload object, or null (bad shape / MAC). */
export async function verifyValue<T = Record<string, unknown>>(value: string | undefined, secret: string): Promise<T | null> {
  if (!secret) return null; // no signing key → nothing can verify (don't throw from hmac())
  const parts = String(value || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expect = await hmac(secret, parts[0]);
  const got = b64uToBytes(parts[1]);
  if (got.length !== expect.length) return null;
  let diff = 0; // constant-time compare: a near-miss MAC reveals nothing
  for (let i = 0; i < expect.length; i++) diff |= expect[i]! ^ got[i]!;
  if (diff !== 0) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Constant-time string equality (for the shared-secret passphrase / bearer). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  // HMAC both sides under a random key so length/content don't leak via timing.
  const k = randomB64u(32);
  const ha = await hmac(k, a); const hb = await hmac(k, b);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i]! ^ hb[i]!;
  return diff === 0;
}
