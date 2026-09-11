// SPDX-License-Identifier: MPL-2.0
/**
 * HMAC-signed values. Enrollment tokens and the OAuth state cookie share one
 * scheme: base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payloadB64,
 * CA_SERVICE_SECRET)). Stateless by design - verification needs only the
 * secret, so the service keeps no session store; replay inside the 10-minute
 * window just re-issues a cert for the same identity + key, which is harmless.
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

/** Bytes → base64url (no padding). */
export const b64u = (bytes) => Buffer.from(bytes).toString('base64url');

/** base64url string → bytes. */
export const b64uToBytes = (str) => new Uint8Array(Buffer.from(String(str), 'base64url'));

/** n random bytes as base64url - state / nonce / PKCE verifier material. */
export const randomB64u = (n = 32) => b64u(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hmac(secret, text) {
  if (!secret) throw new Error('CA_SERVICE_SECRET is not set');
  const key = await subtle.importKey('raw', te.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', key, te.encode(text)));
}

/** Sign a JSON-able payload → 'payloadB64.macB64'. */
export async function signValue(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${b64u(await hmac(secret, body))}`;
}

/** Verify + decode a signed value → payload object, or null (bad shape / MAC). */
export async function verifyValue(value, secret) {
  const parts = String(value || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expect = await hmac(secret, parts[0]);
  const got = b64uToBytes(parts[1]);
  if (got.length !== expect.length) return null;
  let diff = 0; // constant-time compare - a near-miss MAC reveals nothing
  for (let i = 0; i < expect.length; i++) diff |= expect[i] ^ got[i];
  if (diff !== 0) return null;
  try {
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export const TOKEN_TTL_SECONDS = 600; // the 10-minute enrollment window

// Domain-separation tag: every signed value carries a `typ` so an enrollment
// token can never be replayed where a state cookie is expected (or vice-versa),
// even though both share signValue + CA_SERVICE_SECRET. Belt-and-braces - their
// payload shapes already differ - but free and standard practice.
export const TOKEN_TYP = 'lolly-ca/enroll';

/**
 * Mint an enrollment token binding a verified identity for ttlSeconds. `days`
 * (the user's 7/30/90/365 lifetime pick) rides inside the token so the choice
 * survives the magic-link round trip - the CA clamps it at issuance.
 */
export async function mintEnrollToken({ email, provider, days }, secret, ttlSeconds = TOKEN_TTL_SECONDS) {
  const iat = Math.floor(Date.now() / 1000);
  return signValue({ typ: TOKEN_TYP, email, provider, iat, exp: iat + ttlSeconds, ...(Number.isFinite(days) ? { days } : {}) }, secret);
}

/** → { ok: true, payload } | { ok: false, error } - never throws on bad input. */
export async function verifyEnrollToken(token, secret) {
  const payload = await verifyValue(token, secret);
  if (!payload) return { ok: false, error: 'invalid enrollment token' };
  if (payload.typ !== TOKEN_TYP) return { ok: false, error: 'wrong token type' };
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return { ok: false, error: 'enrollment token expired' };
  if (!payload.email || !payload.provider) return { ok: false, error: 'enrollment token carries no identity' };
  return { ok: true, payload };
}
