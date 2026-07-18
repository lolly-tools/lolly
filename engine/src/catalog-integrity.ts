// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog signing + runtime integrity verification — the SOVEREIGNTY.md
 * "catalog origin is a trust anchor" gap, closed.
 *
 * A deployment signs its tool catalog at BUILD time (scripts/sign-catalog.ts
 * writes `catalog/tools/index.sig.json`) and a shell that pins the deployment's
 * public key verifies at RUNTIME, before any tool code executes:
 *
 *   envelope = {
 *     alg:       'ECDSA-P256-SHA256'
 *     keyId:     RFC 7638 JWK thumbprint of the signing key (base64url)
 *     signedAt:  ISO timestamp
 *     indexHash: sha256 hex of the EXACT catalog/tools/index.json bytes
 *     files:     '<toolId>/<filename>' → sha256 hex, for every tool file the
 *                loader can fetch (tool.json, template.html, styles.css,
 *                hooks.js, template.{ics,vcf,csv,md}, plus each i18n/<lang>.json
 *                sidecar the tool ships)
 *     signature: base64url raw-r||s ECDSA P-256/SHA-256 over the canonical-JSON
 *                bytes of the envelope MINUS this field
 *   }
 *
 * Canonical JSON (recursively key-sorted, no whitespace) is the signed byte
 * form on both sides — signer and verifier share canonicalJson() below, so
 * there is exactly one serialization to get right. File digests are over raw
 * file bytes at sign time and over the UTF-8 encoding of the fetched text at
 * verify time — identical for the valid-UTF-8 text files tools are made of.
 *
 * Pure + DOM-free: globalThis.crypto.subtle only (browsers and Node 20+).
 * Enforcement lives in loader.ts (LoadToolOpts.integrity): a hooks.js whose
 * bytes don't match the signed digest is refused BEFORE the runtime compiles
 * it. Fail closed on any mismatch when a signature is expected; unsigned
 * catalogs keep working (dev/compat) with a one-time console warning.
 */

import { pemToDer } from './x509.ts';
import { asBufferSource, base64ToBytes, bytesToHex, sha256 } from './bytes.ts';

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export const CATALOG_SIG_ALG = 'ECDSA-P256-SHA256';
/** Where the envelope lives, relative to the catalog root (sibling of tools/index.json). */
export const CATALOG_SIG_PATH = 'tools/index.sig.json';
/** Fixed tool-directory filenames covered by the signature. Together with the
 *  i18n sidecars (below), exactly the set loadTool can fetch. */
export const CATALOG_SIGNED_TOOL_FILES = [
  'tool.json', 'template.html', 'styles.css', 'hooks.js',
  'template.ics', 'template.vcf', 'template.csv', 'template.md',
] as const;
/** Per-tool i18n sidecars (`i18n/<lang>.json`) are signed too — but they're
 *  per-language and OPTIONAL per tool, so the signer enumerates whatever exists
 *  on disk against this pattern instead of a fixed list. Signer and any
 *  validator share it so an envelope key like `qr-code/i18n/de.json` means
 *  exactly one thing on both sides. */
export const CATALOG_SIGNED_I18N_SIDECAR = /^i18n\/[a-z0-9-]+\.json$/;

const EC_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ECDSA_SHA256 = { name: 'ECDSA', hash: 'SHA-256' } as const;

/** The envelope minus its signature — the exact object the signature covers. */
export interface UnsignedCatalogEnvelope {
  alg: typeof CATALOG_SIG_ALG;
  keyId: string;
  signedAt: string;
  /** sha256 hex of the exact catalog/tools/index.json bytes. */
  indexHash: string;
  /** '<toolId>/<filename>' → sha256 hex of that file's bytes. */
  files: Record<string, string>;
}

/** The signed catalog envelope, as written to catalog/tools/index.sig.json. */
export interface CatalogSignatureEnvelope extends UnsignedCatalogEnvelope {
  /** base64url (unpadded) raw 64-byte r||s ECDSA signature. */
  signature: string;
}

/** A verification outcome: ok, or why not (human-readable, safe to surface). */
export interface IntegrityResult {
  ok: boolean;
  reason?: string;
}

// --- base64url <-> bytes (URL-safe, unpadded; same codec as url-pack.ts) ----

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  return base64ToBytes(str.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Canonical JSON: recursively key-sorted objects, no whitespace, undefined
 * object members dropped (as JSON.stringify does). The ONE serialization the
 * signature covers — signer and verifier both call this, never JSON.stringify.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    // Primitives: defer to JSON.stringify (number/string/boolean formatting is
    // already deterministic). undefined/function have no JSON form → null.
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(v => canonicalJson(v)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    if (record[key] === undefined) continue;
    parts.push(JSON.stringify(key) + ':' + canonicalJson(record[key]));
  }
  return '{' + parts.join(',') + '}';
}

/** Lowercase sha256 hex of the given bytes. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return bytesToHex(await sha256(bytes));
}

/**
 * RFC 7638 JWK thumbprint (base64url of sha256 over the canonical required
 * members) — the stable `keyId` for a P-256 key. canonicalJson over the
 * {crv,kty,x,y} subset IS the RFC's lexicographically-ordered form.
 */
export async function jwkThumbprint(jwk: JsonWebKey): Promise<string> {
  if (jwk.kty !== 'EC' || !jwk.crv || !jwk.x || !jwk.y) {
    throw new Error('catalog integrity: keyId needs an EC JWK with crv/x/y');
  }
  const canonical = canonicalJson({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const digest = new Uint8Array(await subtle.digest('SHA-256', asBufferSource(te.encode(canonical))));
  return bytesToBase64Url(digest);
}

/**
 * Import the pinned catalog public key for verification. Accepts an SPKI PEM
 * string, a JWK JSON string, or a JsonWebKey object — the two forms
 * sign-catalog.ts emits, so a deployment can pin whichever it stored.
 */
export async function importSpkiOrJwkPublicKey(key: string | JsonWebKey): Promise<CryptoKey> {
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed.startsWith('{')) {
      return subtle.importKey('jwk', JSON.parse(trimmed) as JsonWebKey, EC_P256, true, ['verify']);
    }
    return subtle.importKey('spki', asBufferSource(pemToDer(trimmed)), EC_P256, true, ['verify']);
  }
  return subtle.importKey('jwk', key, EC_P256, true, ['verify']);
}

/**
 * Sign an envelope. The signature covers the canonical-JSON bytes of exactly
 * the object passed in, so verifyEnvelopeSignature (which strips `signature`
 * and re-canonicalises the rest) round-trips any extra fields too.
 */
export async function signCatalogEnvelope(
  unsigned: UnsignedCatalogEnvelope,
  privateKey: CryptoKey,
): Promise<CatalogSignatureEnvelope> {
  const bytes = te.encode(canonicalJson(unsigned));
  const raw = new Uint8Array(await subtle.sign(ECDSA_SHA256, privateKey, asBufferSource(bytes)));
  return { ...unsigned, signature: bytesToBase64Url(raw) };
}

/**
 * Verify ONLY the envelope's own signature (shape + ECDSA over the canonical
 * bytes minus `signature`). The loader uses this once per envelope; binding
 * the envelope to the fetched index bytes is verifyCatalogEnvelope's job.
 */
export async function verifyEnvelopeSignature(
  envelope: CatalogSignatureEnvelope,
  publicKey: CryptoKey,
): Promise<IntegrityResult> {
  if (!envelope || typeof envelope !== 'object') return { ok: false, reason: 'envelope missing' };
  if (envelope.alg !== CATALOG_SIG_ALG) return { ok: false, reason: `unsupported alg "${String(envelope.alg)}"` };
  if (!envelope.files || typeof envelope.files !== 'object' || Array.isArray(envelope.files)) {
    return { ok: false, reason: 'envelope has no files map' };
  }
  if (typeof envelope.signature !== 'string' || !envelope.signature) {
    return { ok: false, reason: 'envelope has no signature' };
  }
  let sig: Uint8Array;
  try {
    sig = base64UrlToBytes(envelope.signature);
  } catch {
    return { ok: false, reason: 'signature is not base64url' };
  }
  if (sig.length !== 64) return { ok: false, reason: 'signature is not a raw P-256 r||s pair' };
  // Strip signature, keep EVERYTHING else (unknown fields included) — any
  // post-signing addition or edit must break verification.
  const { signature: _sig, ...unsigned } = envelope;
  const bytes = te.encode(canonicalJson(unsigned));
  const ok = await subtle.verify(ECDSA_SHA256, publicKey, asBufferSource(sig), asBufferSource(bytes));
  return ok ? { ok: true } : { ok: false, reason: 'signature does not verify against the pinned key' };
}

/**
 * Full envelope check: signature valid AND indexHash matches the exact bytes
 * of the catalog/tools/index.json the shell just fetched. Run at sync time.
 */
export async function verifyCatalogEnvelope(
  envelope: CatalogSignatureEnvelope,
  indexBytes: Uint8Array,
  publicKey: CryptoKey,
): Promise<IntegrityResult> {
  const sigResult = await verifyEnvelopeSignature(envelope, publicKey);
  if (!sigResult.ok) return sigResult;
  const actual = await sha256Hex(indexBytes);
  if (actual !== envelope.indexHash) {
    return { ok: false, reason: `tool index does not match its signed hash (signed ${envelope.indexHash}, got ${actual})` };
  }
  return { ok: true };
}

/**
 * Verify one fetched tool file against the signed digest map. A file ABSENT
 * from the map fails — an unsigned extra file is indistinguishable from an
 * injected one, so the only safe answer is no. (Envelope signature is checked
 * separately/once; this is the hot per-file path.)
 */
export async function verifyToolFile(
  envelope: CatalogSignatureEnvelope,
  toolId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<IntegrityResult> {
  const key = `${toolId}/${filename}`;
  const expected = envelope?.files?.[key];
  if (typeof expected !== 'string') {
    return { ok: false, reason: `"${key}" is not in the signed catalog manifest` };
  }
  const actual = await sha256Hex(bytes);
  if (actual !== expected) {
    return { ok: false, reason: `"${key}" does not match its signed digest (signed ${expected}, got ${actual})` };
  }
  return { ok: true };
}
