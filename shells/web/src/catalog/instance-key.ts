// SPDX-License-Identifier: MPL-2.0
/**
 * The catalog key of the Lolly Work instance that serves this web app.
 *
 * A release build pins the publisher's catalog key (catalog/integrity.ts) and refuses
 * any catalog that key did not sign. A Work instance signs each person's filtered
 * catalog with a key of its own (`LW_CATALOG_SIGNING_KEY`), so a published web app
 * served by Work used to show no tools. Work now serves the public half of that key
 * at {@link INSTANCE_KEY_PATH}, and this module decides when the web app may use that key.
 *
 * THE RULES, and why trust does not widen:
 *
 * 1. Same origin only. The key is read from the origin that served this page's own
 *    scripts, and only while the catalog comes from that origin too: never from an
 *    instance base on another origin, and never inside the desktop or mobile apps,
 *    whose bundled copy has an origin of its own. Whoever answers on this origin
 *    already chooses the code this page runs, so believing that origin about its
 *    catalog key adds no party the page did not already trust.
 * 2. Asked only when needed. integrity.ts calls this module only for an envelope
 *    whose keyId is not the build-time key's. A static host such as lolly.tools serves
 *    publisher-signed envelopes, so its web app never sends this request and behaves
 *    exactly as before.
 * 3. Bound to the envelope. The instance key verifies only an envelope that carries
 *    its keyId. Any other envelope is still checked against the build-time key alone.
 * 4. No downgrade. A failure never adds a key and never removes the signature check:
 *    an unsigned catalog, or one signed by any key other than the build-time key or
 *    this origin's current key, is refused as before.
 *
 * ROTATION, CACHING AND OFFLINE. Each catalog load reads the document again (the
 * service worker passes `/api/` straight to the network, and Work answers with
 * `must-revalidate`), and the answer decides which key the load may use:
 *
 *   - a valid document: its key, which is saved for this origin and replaces any key
 *     saved before. After a rotation the old key stops verifying anything at once.
 *   - a definitive "no key here" (404, 405, 410, or a page that is not JSON, which is
 *     what a static host or a Work server without signing answers): no instance key,
 *     and the saved one is forgotten.
 *   - anything else (offline, a timeout, a server error, a refusal from a proxy, a
 *     malformed document): the key saved for this origin, if any, unchanged. That is
 *     how an offline device can still verify the catalog it accepted earlier.
 *
 * The saved key lives in IndexedDB beside the accepted catalog (catalog/trust-store.ts),
 * keyed by origin, so it is never offered to another origin. Anything able to write
 * there already runs as this origin.
 *
 * PAIRING, LATER. Plan 324 section 8 pairs the desktop and mobile apps with a home
 * server by QR code. The code can carry this key's keyId beside the certificate
 * fingerprint, and a paired app would then call {@link resolveInstanceCatalogKey}
 * against the instance with `expectedKeyId` set, so the network can supply the key
 * but never choose the key. Until then {@link instanceKeyAllowed} keeps those apps on
 * their build-time key.
 */
import { jwkThumbprint } from '../../../../engine/src/catalog-integrity.ts';

/** Work's route for the document (lolly-work `server/src/catalog/signing.ts`). */
export const INSTANCE_KEY_PATH = '/api/v1/catalog/public-key';
/** Matches the envelope algorithm the engine verifies. */
const CATALOG_SIG_ALG = 'ECDSA-P256-SHA256';
/** The document is a few hundred bytes; anything larger is not one. */
const MAX_DOCUMENT_BYTES = 4096;
/** Long enough for a busy server; a hung network falls back to the saved key. */
const DEFAULT_TIMEOUT_MS = 8000;
/** A P-256 coordinate and a SHA-256 thumbprint are both 43 base64url characters. */
const BASE64URL_32 = /^[A-Za-z0-9_-]{43}$/;

export interface InstanceCatalogKey {
  keyId: string;
  publicKey: CryptoKey;
  /** `served` when read just now, `saved` when the saved copy stood in for an answer. */
  source: 'served' | 'saved';
}

/** The public members a verifier needs. Nothing else is read, kept or imported. */
export interface PublicJwk { kty: 'EC'; crv: 'P-256'; x: string; y: string }
/** What is saved per origin. */
export interface SavedInstanceKey { v: 1; keyId: string; publicKey: PublicJwk }

export interface InstanceKeyIO {
  /** The origin that served this page, for example `https://work.example.com`. */
  origin: string;
  fetch(url: string, init: RequestInit): Promise<Response>;
  load(origin: string): Promise<unknown>;
  save(origin: string, record: SavedInstanceKey): Promise<void>;
  forget(origin: string): Promise<void>;
  timeoutMs?: number;
  /** For a paired app (see the header): accept only a key with this keyId. */
  expectedKeyId?: string;
}

export interface InstanceKeyEnvironment {
  /** The page's own origin (`location.origin`), or null when there is none. */
  pageOrigin: string | null;
  /** The configured instance base, '' for this origin's own content. */
  instanceBase: string;
  /** True inside the desktop or mobile app. */
  tauri: boolean;
}

/**
 * Whether this page may take a catalog key from its own origin: a browser page whose
 * catalog comes from the origin that served the page. The desktop and mobile apps, and a
 * page pointed at an instance on another origin, keep their build-time key.
 */
export function instanceKeyAllowed(env: InstanceKeyEnvironment): boolean {
  if (env.tauri || !env.pageOrigin || !/^https?:\/\//.test(env.pageOrigin)) return false;
  if (!env.instanceBase) return true;
  try { return new URL(env.instanceBase).origin === env.pageOrigin; } catch { return false; }
}

/** Validate a document or a saved record down to its four public members. */
async function readPublicKey(value: unknown): Promise<{ keyId: string; jwk: PublicJwk } | null> {
  if (!value || typeof value !== 'object') return null;
  const doc = value as { version?: unknown; v?: unknown; alg?: unknown; keyId?: unknown; publicKey?: unknown };
  const key = doc.publicKey as Partial<PublicJwk> & { d?: unknown } | undefined;
  if (!key || typeof key !== 'object' || 'd' in key) return null;
  if (key.kty !== 'EC' || key.crv !== 'P-256' || !BASE64URL_32.test(String(key.x)) || !BASE64URL_32.test(String(key.y))) return null;
  if (typeof doc.keyId !== 'string' || !BASE64URL_32.test(doc.keyId)) return null;
  const jwk: PublicJwk = { kty: 'EC', crv: 'P-256', x: key.x!, y: key.y! };
  // The keyId is recomputed, never taken on trust: it is what binds the key to envelopes.
  if (await jwkThumbprint(jwk) !== doc.keyId) return null;
  return { keyId: doc.keyId, jwk };
}

/** Parse the served document. Exported for tests. */
export async function parseInstanceKeyDocument(value: unknown): Promise<{ keyId: string; jwk: PublicJwk } | null> {
  if (!value || typeof value !== 'object') return null;
  const doc = value as { version?: unknown; alg?: unknown };
  if (doc.version !== 1 || doc.alg !== CATALOG_SIG_ALG) return null;
  return readPublicKey(value);
}

const importKey = (jwk: PublicJwk): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

/** A body larger than the cap is not the document. */
async function boundedText(response: Response): Promise<string | null> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength > MAX_DOCUMENT_BYTES ? null : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

type Answer =
  | { kind: 'key'; keyId: string; jwk: PublicJwk }
  | { kind: 'none' }
  | { kind: 'unanswered' };

/** Ask this origin for its key and classify the answer by the rules in the header. */
async function ask(io: InstanceKeyIO): Promise<Answer> {
  let response: Response;
  try {
    response = await io.fetch(io.origin + INSTANCE_KEY_PATH, {
      cache: 'no-cache', credentials: 'same-origin', redirect: 'error',
      signal: AbortSignal.timeout(io.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'unanswered' };
  }
  try {
    // A redirect is refused above; this also refuses an answer from anywhere else.
    if (response.url && new URL(response.url).origin !== io.origin) return { kind: 'unanswered' };
    if ([404, 405, 410].includes(response.status)) return { kind: 'none' };
    if (!response.ok) return { kind: 'unanswered' };
    if (!/\bjson\b/i.test(response.headers.get('content-type') ?? '')) return { kind: 'none' };
    const text = await boundedText(response);
    const parsed = text === null ? null : await parseInstanceKeyDocument(JSON.parse(text));
    return parsed ? { kind: 'key', ...parsed } : { kind: 'unanswered' };
  } catch {
    return { kind: 'unanswered' };
  }
}

/**
 * The key this origin's Work instance signs its catalog with, or null. Never throws:
 * every failure ends in the saved key or in null, and null leaves the build-time key
 * as the only key.
 */
export async function resolveInstanceCatalogKey(io: InstanceKeyIO): Promise<InstanceCatalogKey | null> {
  const expected = (keyId: string): boolean => !io.expectedKeyId || keyId === io.expectedKeyId;
  const answer = await ask(io);
  if (answer.kind === 'key' && expected(answer.keyId)) {
    try {
      const publicKey = await importKey(answer.jwk);
      await io.save(io.origin, { v: 1, keyId: answer.keyId, publicKey: answer.jwk }).catch(() => {});
      return { keyId: answer.keyId, publicKey, source: 'served' };
    } catch { return null; }
  }
  if (answer.kind === 'none') {
    await io.forget(io.origin).catch(() => {});
    return null;
  }
  if (answer.kind === 'key') return null; // a key the pairing did not name
  try {
    const saved = await io.load(io.origin);
    if (!saved || typeof saved !== 'object' || (saved as { v?: unknown }).v !== 1) return null;
    const parsed = await readPublicKey(saved);
    if (!parsed || !expected(parsed.keyId)) return null;
    return { keyId: parsed.keyId, publicKey: await importKey(parsed.jwk), source: 'saved' };
  } catch {
    return null;
  }
}

/**
 * The key that may verify an envelope. The build-time key unless the envelope names
 * another keyId and this origin's instance key carries exactly that keyId. The
 * instance key is fetched at most once per selector, and only on demand, so a
 * publisher-signed catalog never causes the request.
 */
export function createCatalogKeySelector(options: {
  pinned: CryptoKey;
  pinnedKeyId: string;
  /** Null when {@link instanceKeyAllowed} says no; the build-time key then stands alone. */
  instanceKey: (() => Promise<InstanceCatalogKey | null>) | null;
}): (envelope: { keyId?: unknown }) => Promise<CryptoKey> {
  let pending: Promise<InstanceCatalogKey | null> | null = null;
  return async (envelope) => {
    const keyId = envelope?.keyId;
    if (!options.instanceKey || typeof keyId !== 'string' || keyId === options.pinnedKeyId) return options.pinned;
    pending ??= options.instanceKey().catch(() => null);
    const instance = await pending;
    return instance && instance.keyId === keyId ? instance.publicKey : options.pinned;
  };
}

/** The RFC 7638 keyId of an imported public key. */
export async function keyIdOf(key: CryptoKey): Promise<string> {
  return jwkThumbprint(await crypto.subtle.exportKey('jwk', key));
}
