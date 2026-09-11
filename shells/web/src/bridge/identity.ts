// SPDX-License-Identifier: MPL-2.0
/**
 * IdentityAPI - Content Credentials signing identity (device key + CA cert).
 *
 * The device holds a non-extractable ECDSA P-256 keypair (WebCrypto
 * extractable:false, persisted in the 'identity' IDB store - CryptoKey objects
 * structured-clone into IndexedDB natively, and even our own code can never
 * export the private key). Enrollment sends only the public key plus a
 * proof-of-possession signature to the Lolly CA (/api/ca/*), which binds an
 * OIDC-verified email to a short-lived X.509 certificate. Exports then sign
 * locally, offline, for the cert's whole lifetime; past expiry (or never
 * enrolled) everything falls back to the engine's ephemeral self-signed path.
 * See docs/content-credentials-identity.md.
 *
 * Shell-internal (host.identity, like host.previews) - deliberately NOT a
 * HostV1 capability: tools can never observe or depend on enrollment.
 */

import { pemToDer } from '../../../../engine/src/x509.ts';
import type { IDBPDatabase } from 'idb';

// The persisted certificate record (the 'cert' entry in the 'identity' store):
// the DER chain the engine signer consumes plus the CA-issued validity window.
interface CertRecord {
  chain: Uint8Array[];
  identity: unknown;
  notBefore: string;
  notAfter: string;
  issuedAt?: string;
}

interface IdentityCache {
  keypair: CryptoKeyPair | null;
  record: CertRecord | null;
}

// Same-origin base path for the Lolly CA service. In dev, Vite proxies it to
// the standalone service (node services/ca/server.mjs); in prod it's a function
// on the same Vercel project - no configuration needed either way.
const CA_BASE = '/api/ca';

const STORE = 'identity';
const KEYPAIR_KEY = 'keypair';
const CERT_KEY = 'cert';

const ENROLL_TIMEOUT_MS = 5 * 60 * 1000; // OIDC involves a human; be generous.
const POPUP_POLL_MS = 1000;

function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// POST JSON to the CA. A non-2xx response throws the body's error message when
// it's JSON (else statusText) so the profile UI can surface it verbatim.
async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(CA_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText || `CA request failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data?.error || data?.message || msg;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  return res.json();
}

// Open the provider's OIDC flow in a popup and wait for the CA callback page to
// postMessage the enrollment token back (correlation/timeout/cleanup shape as
// in capture-extension.js). Rejects on popup-blocked, closed-without-a-token,
// or timeout. Only messages from our own origin are accepted - the callback
// page posts to the origin it was handed at /auth time.
function popupToken(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `${CA_BASE}/auth/${provider}?origin=${encodeURIComponent(location.origin)}`;
    const popup = window.open(url, 'lolly-ca-enroll', 'width=480,height=640');
    if (!popup) {
      reject(new Error('Sign-in popup was blocked - allow popups for this site and try again.'));
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      if (closePoll != null) clearInterval(closePoll);
      window.removeEventListener('message', onMessage);
      bc?.close();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Enrollment timed out - the sign-in window never responded.'));
    }, ENROLL_TIMEOUT_MS);
    // The callback page posts the token and then closes itself, so a closed
    // popup with no message means the user dismissed the window. Under
    // cross-origin isolation a SEVERED opener handle also reads closed, so
    // there the poll must stand down and the timeout is the cancel signal.
    const closePoll = globalThis.crossOriginIsolated ? null : setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Sign-in window was closed before enrollment completed.'));
      }
    }, POPUP_POLL_MS);

    const accept = (m: { source?: string; type?: string; token?: string } | null) => {
      if (!m || m.source !== 'lolly-ca' || m.type !== 'enroll-token' || !m.token) return;
      cleanup();
      resolve(m.token);
    };
    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin) return;
      accept(event.data);
    }
    // The isolation-proof channel: with COOP severing the opener on the
    // provider's pages, the callback page broadcasts instead (same-origin,
    // same isolation partition - services/ca lib/pages.mjs posts to both).
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('lolly-ca');
      bc.onmessage = (e) => accept(e.data as { source?: string; type?: string; token?: string } | null);
    } catch { /* no BroadcastChannel - the opener path covers it */ }
    window.addEventListener('message', onMessage);
  });
}

export function createIdentityAPI(db: IDBPDatabase) {
  // Closure cache so repeat signer() calls (a zip export stamps every member)
  // pay IndexedDB once. Invalidated by completeEnrollment/forget.
  let cache: IdentityCache | null = null; // { keypair: CryptoKeyPair|null, record: { chain, identity, … }|null }

  // Cross-tab invalidation: enroll/forget in one tab must not leave another tab
  // signing from a stale cache (still signing after "Forget", or with the old
  // cert after a renew). A BroadcastChannel ping drops every tab's cache; each
  // tab re-reads IDB on the next call. Guarded - not every host has it.
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lolly:identity') : null;
  if (channel) channel.onmessage = () => { cache = null; };
  const announceChange = () => { try { channel?.postMessage('changed'); } catch { /* channel closed */ } };

  async function load(): Promise<IdentityCache> {
    if (!cache) {
      const [keypair, record] = await Promise.all([
        db.get(STORE, KEYPAIR_KEY),
        db.get(STORE, CERT_KEY),
      ]);
      cache = { keypair: keypair ?? null, record: record ?? null };
    }
    return cache;
  }

  // Inside the cert's validity window? Not-yet-valid (clock skew) reads the
  // same as expired - either way the cert can't sign and needs renewal.
  function within(record: CertRecord, now: number = Date.now()): boolean {
    return now >= Date.parse(record.notBefore) && now <= Date.parse(record.notAfter);
  }

  async function status() {
    const { record } = await load();
    if (!record) return { enrolled: false };
    const now = Date.now();
    return {
      enrolled: true,
      identity: record.identity,
      notBefore: record.notBefore,
      notAfter: record.notAfter,
      expired: !within(record, now),
      daysLeft: Math.max(0, Math.ceil((Date.parse(record.notAfter) - now) / 86400000)),
    };
  }

  // Second half of enrollment: prove possession of the device key and trade the
  // short-lived enrollment token for a certificate chain. Also the re-entry
  // point for the email magic-link flow. `days` is the user's lifetime pick
  // (7/30/90/365) - advisory only; the CA clamps it server-side. The email
  // flow's choice rides inside the token instead (minted at /email/start).
  async function completeEnrollment(token: string, days?: number) {
    // Ensure the device keypair. extractable:false is the whole point - the
    // private key can never leave the device, only signatures do.
    let { keypair } = await load();
    if (!keypair) {
      keypair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      await db.put(STORE, keypair, KEYPAIR_KEY);
    }
    // CSR-less enrollment: raw SPKI + a proof-of-possession signature over the
    // token bytes (raw 64-byte r||s - WebCrypto's native ECDSA output).
    const pop = new Uint8Array(await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keypair.privateKey,
      new TextEncoder().encode(String(token)),
    ));
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keypair.publicKey));
    const res = await postJson('/enroll', {
      token,
      spki: b64url(spki),
      pop: b64url(pop),
      ...(Number.isFinite(days) ? { days } : {}),
    });
    const chainPem = Array.isArray(res.chain) && res.chain.length ? res.chain : [res.cert];
    await db.put(STORE, {
      chain: chainPem.map(pemToDer), // Uint8Array[] leaf-first - the engine signer shape
      identity: res.identity,
      notBefore: res.notBefore,
      notAfter: res.notAfter,
      issuedAt: new Date().toISOString(),
    }, CERT_KEY);
    cache = null;
    announceChange();
    return status();
  }

  return {
    status,
    completeEnrollment,

    // 'email' starts a magic-link flow that re-enters via completeEnrollment;
    // every other provider ('github' | 'google' | 'suse' | 'dev') runs the OIDC
    // popup and finishes enrollment in place.
    async enroll(provider: string, opts: { days?: number; email?: string } = {}) {
      const days = Number(opts.days);
      if (provider === 'email') {
        await postJson('/email/start', {
          email: opts.email,
          origin: location.origin,
          ...(Number.isFinite(days) ? { days } : {}),
        });
        return { pending: 'email' };
      }
      return completeEnrollment(await popupToken(provider), days);
    },

    // The engine signer (embedC2pa opts.signer) - null unless enrolled AND the
    // cert is currently valid, so an expired identity falls back to the
    // engine's ephemeral self-signed path automatically.
    async signer() {
      const { keypair, record } = await load();
      if (!keypair || !record?.chain?.length || !within(record)) return null;
      return { privateKey: keypair.privateKey, certDer: record.chain[0]!, chain: record.chain };
    },

    async forget() {
      await db.delete(STORE, KEYPAIR_KEY);
      await db.delete(STORE, CERT_KEY);
      cache = null;
      announceChange(); // stop any other open tab from signing with the dropped key
    },
  };
}
