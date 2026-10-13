// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog signing + runtime integrity verification - the SOVEREIGNTY.md
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
 *                sidecar the tool ships) and every starter template
 *                (templates/<tid>.json) it offers
 *     signature: base64url raw-r||s ECDSA P-256/SHA-256 over the canonical-JSON
 *                bytes of the envelope MINUS this field
 *   }
 *
 * Canonical JSON (recursively key-sorted, no whitespace) is the signed byte
 * form on both sides - signer and verifier share canonicalJson() below, so
 * there is exactly one serialization to get right. File digests are over raw
 * file bytes at sign time and over the UTF-8 encoding of the fetched text at
 * verify time - identical for the valid-UTF-8 text files tools are made of.
 *
 * Pure + DOM-free: globalThis.crypto.subtle only (browsers and Node 20+).
 * Enforcement lives in loader.ts (LoadToolOpts.integrity): a hooks.js whose
 * bytes don't match the signed digest is refused BEFORE the runtime compiles
 * it. Fail closed on any mismatch when a signature is expected; unsigned
 * catalogs keep working (dev/compat) with a one-time console warning.
 */

import { canonicalJson } from './canonical-json.ts';
import { pemToDer } from './x509.ts';
import { asBufferSource, base64ToBytes, sha256Hex } from './bytes.ts';

const te = new TextEncoder();
const subtle = globalThis.crypto?.subtle;
function webCrypto(): SubtleCrypto {
  if (!subtle) throw new Error('catalog integrity: WebCrypto unavailable');
  return subtle;
}

export const CATALOG_SIG_ALG = 'ECDSA-P256-SHA256';
/** Where the envelope lives, relative to the catalog root (sibling of tools/index.json). */
export const CATALOG_SIG_PATH = 'tools/index.sig.json';
/**
 * Sibling text-template extensions loadTool fetches (`template.<ext>`), one
 * per data export format the engine hydrates from the model. loader.ts filters
 * this by the manifest's declared formats, so it is also the complete set of
 * text templates a tool can ship - which is why the signed-file list below is
 * DERIVED from it rather than hand-kept beside it. The two drifted once
 * (css/scss/gpl/json were fetchable but unsigned, and srt/vtt joined them in
 * 1.150), and under a signed catalog that drift is fatal: verifyToolFile fails
 * closed on a file the envelope never named, so a tool shipping template.gpl
 * refused to load at all.
 */
export const TEXT_TEMPLATE_EXTS = [
  'ics', 'vcf', 'csv', 'srt', 'vtt', 'md', 'css', 'scss', 'gpl', 'json',
] as const;

/** Fixed tool-directory filenames covered by the signature. Together with the
 *  i18n sidecars (below), exactly the set loadTool can fetch. */
export const CATALOG_SIGNED_TOOL_FILES: readonly string[] = [
  'tool.json', 'template.html', 'styles.css', 'hooks.js', 'presentation.js', 'SKILL.md', 'skill.json',
  ...TEXT_TEMPLATE_EXTS.map((ext) => `template.${ext}`),
];
/** Per-tool i18n sidecars (`i18n/<lang>.json`) are signed too - but they're
 *  per-language and OPTIONAL per tool, so the signer enumerates whatever exists
 *  on disk against this pattern instead of a fixed list. Signer and any
 *  validator share it so an envelope key like `qr-code/i18n/de.json` means
 *  exactly one thing on both sides. */
export const CATALOG_SIGNED_I18N_SIDECAR = /^i18n\/[a-z0-9-]+\.json$/;
/** Per-tool starter templates (`templates/<tid>.json`) are signed on the same
 *  enumerate-what-exists footing as the i18n sidecars. They differ from every
 *  other entry in one way: loadTool never fetches one. A template is read
 *  later, when a person picks a starting point, and its `values` seed a
 *  whole document - the artboards, the copy, the colours. Unsigned, that is the
 *  one file a hostile CDN could rewrite to change what every new document starts
 *  as, with the tool code itself passing verification untouched. So the envelope
 *  covers them and scripts/validate-catalog.ts refuses a template filename this
 *  pattern would skip, which would otherwise ship as a quietly unsigned file. */
export const CATALOG_SIGNED_TEMPLATE_FILE = /^templates\/[A-Za-z0-9._-]+\.json$/;

const EC_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ECDSA_SHA256 = { name: 'ECDSA', hash: 'SHA-256' } as const;

/** The envelope minus its signature - the exact object the signature covers. */
export interface UnsignedCatalogEnvelope {
  alg: typeof CATALOG_SIG_ALG;
  keyId: string;
  signedAt: string;
  /** Publisher-monotonic revision; deliberate rollback requires a higher revision. */
  seq?: number;
  /** Optional expiry; omitted for catalogs that must remain usable offline. */
  expiresAt?: string;
  /** Exact asset and slim index bytes. Missing only for legacy envelopes. */
  assetIndexHash?: string;
  slimHash?: string;
  /** Opaque visibility partition signed by an instance; absent from public catalogs. */
  catalogScope?: string;
  /** Full directory hashes; files remain keyed by logical tool id. */
  toolDirs?: Record<string, string>;
  /** sha256 hex of the exact catalog/tools/index.json bytes. */
  indexHash: string;
  /** '<toolId>/<filename>' → sha256 hex of that file's bytes. */
  files: Record<string, string>;
  /** Exact public preview and documentation resource paths mapped to byte digests. */
  resources?: Record<string, string>;
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
 * signature covers - signer and verifier both call this, never JSON.stringify.
 */
export { canonicalJson } from './canonical-json.ts';

/** Lowercase sha256 hex of the given bytes. Implemented in `bytes.ts` (the leaf
 *  every consumer can import without pulling this module's x509 dependency in
 *  behind it) and re-exported here, which is where the barrel and the signing
 *  script have always read it from. */
export { sha256Hex } from './bytes.ts';

/**
 * RFC 7638 JWK thumbprint (base64url of sha256 over the canonical required
 * members) - the stable `keyId` for a P-256 key. canonicalJson over the
 * {crv,kty,x,y} subset IS the RFC's lexicographically-ordered form.
 */
export async function jwkThumbprint(jwk: JsonWebKey): Promise<string> {
  if (jwk.kty !== 'EC' || !jwk.crv || !jwk.x || !jwk.y) {
    throw new Error('catalog integrity: keyId needs an EC JWK with crv/x/y');
  }
  const canonical = canonicalJson({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const digest = new Uint8Array(await webCrypto().digest('SHA-256', asBufferSource(te.encode(canonical))));
  return bytesToBase64Url(digest);
}

/**
 * Import the pinned catalog public key for verification. Accepts an SPKI PEM
 * string, a JWK JSON string, or a JsonWebKey object - the two forms
 * sign-catalog.ts emits, so a deployment can pin whichever it stored.
 */
export async function importSpkiOrJwkPublicKey(key: string | JsonWebKey): Promise<CryptoKey> {
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed.startsWith('{')) {
      return webCrypto().importKey('jwk', JSON.parse(trimmed) as JsonWebKey, EC_P256, true, ['verify']);
    }
    return webCrypto().importKey('spki', asBufferSource(pemToDer(trimmed)), EC_P256, true, ['verify']);
  }
  return webCrypto().importKey('jwk', key, EC_P256, true, ['verify']);
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
  const raw = new Uint8Array(await webCrypto().sign(ECDSA_SHA256, privateKey, asBufferSource(bytes)));
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
  const shape = catalogEnvelopeShape(envelope);
  if (!shape.ok) return shape;
  let sig: Uint8Array;
  try {
    sig = base64UrlToBytes(envelope.signature);
  } catch {
    return { ok: false, reason: 'signature is not base64url' };
  }
  if (sig.length !== 64) return { ok: false, reason: 'signature is not a raw P-256 r||s pair' };
  // Strip signature, keep EVERYTHING else (unknown fields included) - any
  // post-signing addition or edit must break verification.
  const { signature: _sig, ...unsigned } = envelope;
  const bytes = te.encode(canonicalJson(unsigned));
  const ok = await webCrypto().verify(ECDSA_SHA256, publicKey, asBufferSource(sig), asBufferSource(bytes));
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
 * from the map fails - an unsigned extra file is indistinguishable from an
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

/** A persisted freshness floor, separate from HTTP validators. */
export interface CatalogWatermark { seq?: number; signedAt: string; }
const digestPattern = /^[0-9a-f]{64}$/;
const toolPattern = /^[a-z0-9][a-z0-9-]*$/i;

/** Validate additive fields before they affect URLs, storage keys or freshness. */
export function catalogEnvelopeShape(envelope: CatalogSignatureEnvelope): IntegrityResult {
  if (!envelope || typeof envelope !== 'object') return { ok: false, reason: 'envelope missing' };
  if (!envelope.files || typeof envelope.files !== 'object' || Array.isArray(envelope.files) || Object.keys(envelope.files).length > 100000) return { ok: false, reason: 'invalid signed file map' };
  for (const [path, digest] of Object.entries(envelope.files)) {
    if (path.length > 1024 || /[\\%?#\p{White_Space}\p{Cc}]/u.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || !digestPattern.test(digest)) return { ok: false, reason: 'invalid signed file digest' };
  }
  if (envelope.resources !== undefined) {
    if (!envelope.resources || typeof envelope.resources !== 'object' || Array.isArray(envelope.resources) || Object.keys(envelope.resources).length > 20000) return { ok: false, reason: 'invalid signed resource map' };
    for (const [path, digest] of Object.entries(envelope.resources)) {
      if (!/^\/(?:catalog\/(?:previews|og)|info\/shots)\//.test(path) || path.length > 1024 || /[\\%?#\p{White_Space}\p{Cc}]/u.test(path)
        || path.slice(1).split('/').some(part => !part || part === '.' || part === '..') || !digestPattern.test(digest)) return { ok: false, reason: 'invalid signed resource digest' };
    }
  }
  if (!digestPattern.test(envelope.indexHash)) return { ok: false, reason: 'invalid signed tool index hash' };
  if (typeof envelope.signedAt !== 'string' || !Number.isFinite(Date.parse(envelope.signedAt))) return { ok: false, reason: 'invalid catalog signing time' };
  if (envelope.seq !== undefined && (!Number.isSafeInteger(envelope.seq) || envelope.seq < 1)) return { ok: false, reason: 'invalid catalog sequence' };
  if (envelope.expiresAt !== undefined && (typeof envelope.expiresAt !== 'string' || !Number.isFinite(Date.parse(envelope.expiresAt)))) return { ok: false, reason: 'invalid catalog expiry' };
  for (const value of [envelope.assetIndexHash, envelope.slimHash, envelope.catalogScope]) {
    if (value !== undefined && !digestPattern.test(value)) return { ok: false, reason: 'invalid signed catalog digest' };
  }
  if (envelope.toolDirs !== undefined) {
    if (!envelope.toolDirs || typeof envelope.toolDirs !== 'object' || Array.isArray(envelope.toolDirs)) return { ok: false, reason: 'invalid tool directory map' };
    for (const [id, hash] of Object.entries(envelope.toolDirs)) if (!toolPattern.test(id) || !digestPattern.test(hash)) return { ok: false, reason: 'invalid tool directory hash' };
  }
  return { ok: true };
}

/** Monotonic checks apply only after the caller has verified the signature. */
export function catalogFreshness(envelope: CatalogSignatureEnvelope, previous: CatalogWatermark | null, now = Date.now()): IntegrityResult {
  const shape = catalogEnvelopeShape(envelope);
  if (!shape.ok) return shape;
  if (envelope.expiresAt !== undefined && Date.parse(envelope.expiresAt) <= now) return { ok: false, reason: 'the trusted catalog has expired' };
  if (previous?.seq !== undefined && (envelope.seq === undefined || envelope.seq < previous.seq)) return { ok: false, reason: 'the catalog offered is older than one already trusted' };
  if (previous && previous.seq === undefined && Date.parse(envelope.signedAt) < Date.parse(previous.signedAt)) return { ok: false, reason: 'the catalog offered is older than one already trusted' };
  return { ok: true };
}

/** Directory identity includes every signed relative filename and its byte hash. */
export async function toolDirectoryHash(files: Record<string, string>, toolId: string): Promise<string> {
  if (!toolPattern.test(toolId)) throw new Error('catalog integrity: invalid tool id');
  const entries = Object.entries(files).filter(([path]) => path.startsWith(toolId + '/'));
  if (!entries.length) throw new Error('catalog integrity: tool directory has no signed files');
  const relative: Record<string, string> = Object.create(null);
  for (const [path, digest] of entries) {
    const name = path.slice(toolId.length + 1);
    if (!name || name.includes('\\') || /[%?#]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..') || !digestPattern.test(digest)) throw new Error('catalog integrity: invalid signed tool path');
    relative[name] = digest;
  }
  return sha256Hex(te.encode(canonicalJson(relative)));
}

/** Hash addresses are validated before entering a request URL. */
export function catalogIndexPath(hash: string, kind: 'tools' | 'assets' | 'slim' = 'tools'): string {
  if (!digestPattern.test(hash)) throw new Error('catalog integrity: invalid index hash');
  return kind === 'assets' ? `/catalog/assets/index.${hash.slice(0, 16)}.json`
    : `/catalog/tools/index${kind === 'slim' ? '.slim' : ''}.${hash.slice(0, 16)}.json`;
}

/** Legacy envelope URLs remain usable for one transition release. */
export function toolDirectoryPath(envelope: CatalogSignatureEnvelope, toolId: string): string {
  if (!toolPattern.test(toolId)) throw new Error('catalog integrity: invalid tool id');
  const hash = envelope.toolDirs?.[toolId];
  if (hash !== undefined && !digestPattern.test(hash)) throw new Error('catalog integrity: invalid directory hash');
  return `/tools/${toolId}${hash ? '@' + hash.slice(0, 16) : ''}`;
}
