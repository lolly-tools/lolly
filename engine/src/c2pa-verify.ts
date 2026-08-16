// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) verifier - pure, DOM-free.
 *
 * The read-side counterpart to c2pa.js: sniffs the container (PDF, PNG/APNG,
 * JPEG, GIF, SVG, TIFF, WebP, MP4/ISO-BMFF, WebM/Matroska), extracts the
 * embedded manifest the way c2pa-rs reads each format, walks the JUMBF store,
 * and re-checks everything a validator checks - the claim's hashed-URI
 * assertion references, the COSE claim signature (WebCrypto ES256/384/512
 * against the x5chain leaf), the certificate validity window, and the hard
 * binding: c2pa.hash.data (sha256 of the file with the exclusion ranges
 * OMITTED) or, for BMFF assets, c2pa.hash.bmff.v2/v3 (sha256 over the
 * surviving top-level boxes, each prefixed with its u64-BE file offset).
 * Entirely on-device: nothing is uploaded, mirroring the trust posture of the
 * writer (self-signed ephemeral keys - a credential is evidence of integrity,
 * not identity).
 *
 * Check codes deliberately reuse the C2PA validation-status vocabulary
 * (`claimSignature.validated`, `assertion.hashedURI.match`,
 * `assertion.dataHash.match`, `signingCredential.untrusted`, …) so a report
 * here reads the same as one from c2patool / verify.contentauthenticity.org.
 * `signingCredential.untrusted` is reported whenever no caller-pinned trust
 * anchor vouches for the chain (the default: there is no trust list and the
 * ephemeral signer is anonymous by design); it is excluded from the `state`
 * verdict, which reflects integrity only. With `opts.trustAnchors` (the same
 * pinning `c2patool --trust_anchors` does), a chain that verifies to a root
 * upgrades the row to `signingCredential.trusted` and surfaces the identity.
 *
 * The report also answers the question users actually ask: was this genuinely
 * made with Lolly? `madeWithLolly` is true when the credential is INTACT and
 * records Lolly as the generator; the `tools.lolly.export` assertion's export
 * context (tool, surface, browser engine, OS) is surfaced as `environment`.
 * That is an integrity statement, not an identity proof - any writer could
 * claim the name, which the view copy is honest about.
 *
 * `likelyMadeWithLolly` softens that verdict for the common re-save case: the
 * claim signature verified and every hashed-URI-bound assertion (the actions
 * we render as edit history, the export-context digest, …) matches what the
 * claim references - so the manifest's CONTENT is trustworthy - but the file's
 * own bytes no longer match the hard binding (it was re-encoded/re-uploaded/
 * re-saved through something that left the manifest alone but touched bytes
 * outside it). We can still honestly show what it was made from and its edit
 * history; we just can't vouch for the current bytes, hence "likely" rather
 * than the flat claim.
 *
 * Like c2pa.js / emf.js / eps.js this is a format authority: no DOM, no
 * Handlebars - fully node:test-able (globalThis.crypto only).
 */

import { encodeCbor, LOLLY_EXPORT_ASSERTION } from './c2pa.ts';
// The check-code vocabulary lives in c2pa-verdict.ts (the shared verdict
// module); every pass/fail below emits through this map so the strings can
// never drift from what the surfaces and tests string-match. (No runtime
// cycle: c2pa-verdict.ts imports only types from this file.)
import { C2PA_CHECK } from './c2pa-verdict.ts';
import { concatBytes, asBufferSource, sha256, bytesToHex as hexOf } from './bytes.ts';
import { derTlv, derChildren, ecdsaDerToRaw, EC_CURVES } from './der-read.ts';
import type { DerTlv } from './der-read.ts';
// Structural extraction (CBOR/JUMBF decoding, per-container manifest sniffing,
// ingredient prep) lives in c2pa-extract.ts - this file is the crypto core only:
// X.509/trust-chain walking and the actual COSE/hash verification. See that
// file's header for why the split. No runtime cycle: it imports only a type
// (C2paHistoryStep) back from here.
import {
  decodeCbor, parseC2paStore, sniffFormat, extractC2paFromPdf, EXTRACTORS,
  collectActionChain, aiKind, extractC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore,
  collectIngredients, bmffTopBoxes, extractC2paDetailed, C2PA_TEXT_STATUS,
} from './c2pa-extract.ts';
import type {
  C2paStoreParts, SniffFormat, C2paIngredientData, BmffBox,
  C2paTextCarrier, C2paTextWrapper, C2paExclusion,
} from './c2pa-extract.ts';
// Re-exported so every existing `from './c2pa-verify.ts'` import (index.ts, the
// test suite, the fuzz harness) keeps working unchanged - callers never need to
// know these moved to c2pa-extract.ts.
export {
  decodeCbor, parseC2paStore, sniffFormat, extractC2paFromPdf,
  extractC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore, collectIngredients, aiKind,
};
export type { C2paIngredientData };

const td = new TextDecoder();
const te = new TextEncoder();
// section A.8's hash input is TEXT, and a leading U+FEFF in it is DATA, not an encoding
// hint. The default decoder silently eats one, which would shift the whole hash
// input by three bytes for any signed text that legitimately begins with a BOM.
const tdText = new TextDecoder('utf-8', { ignoreBOM: true });
const subtle = globalThis.crypto.subtle;

// ─── DER / X.509 (read side) ──────────────────────────────────────────────────
// The TLV walker (derTlv/derChildren) lives in der-read.ts, shared with
// x509.ts and seal.ts.

function decodeOid(b: Uint8Array, tlv: DerTlv): string {
  const bytes = b.slice(tlv.contentStart, tlv.end);
  const parts = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i]! & 0x7f);
    if (!(bytes[i]! & 0x80)) { parts.push(v); v = 0; }
  }
  return parts.join('.');
}

// UTCTime (YYMMDD…Z, RFC 5280 sliding window) or GeneralizedTime (YYYYMMDD…Z).
function decodeTime(b: Uint8Array, tlv: DerTlv): Date {
  const s = td.decode(b.slice(tlv.contentStart, tlv.end));
  const four = tlv.tag === 0x18;
  const yy = four ? +s.slice(0, 4) : (+s.slice(0, 2) < 50 ? 2000 + +s.slice(0, 2) : 1900 + +s.slice(0, 2));
  const o = four ? 2 : 0;
  return new Date(Date.UTC(yy, +s.slice(2 + o, 4 + o) - 1, +s.slice(4 + o, 6 + o), +s.slice(6 + o, 8 + o), +s.slice(8 + o, 10 + o), +s.slice(10 + o, 12 + o)));
}

export interface DName { commonName?: string; organization?: string; }

// Name → { commonName, organization } (first CN / O attribute found).
function decodeName(cert: Uint8Array, nameTlv: DerTlv): DName {
  const out: DName = {};
  for (const rdn of derChildren(cert, nameTlv)) {           // SET
    for (const atv of derChildren(cert, rdn)) {             // SEQUENCE { oid, value }
      const [oidTlv, valTlv] = derChildren(cert, atv);
      if (!oidTlv || !valTlv || oidTlv.tag !== 0x06) continue;
      const oid = decodeOid(cert, oidTlv);
      const val = td.decode(cert.slice(valTlv.contentStart, valTlv.end));
      if (oid === '2.5.4.3' && out.commonName == null) out.commonName = val;
      if (oid === '2.5.4.10' && out.organization == null) out.organization = val;
    }
  }
  return out;
}

// [3] extensions walk: SAN rfc822Name emails + basicConstraints cA. Every
// read goes through der-read.ts's derTlv (bounds-checked BEFORE use - the GIF
// lesson) and a hostile/malformed extension block degrades to the defaults,
// never throws: certificates come straight out of attacker-controlled files.
function decodeExtensions(cert: Uint8Array, kids: DerTlv[], shift: number): { sanEmails: string[]; isCa: boolean } {
  const out: { sanEmails: string[]; isCa: boolean } = { sanEmails: [], isCa: false };
  try {
    const wrap = kids.slice(shift + 6).find((k) => k.tag === 0xa3);
    if (!wrap) return out;
    const [seq] = derChildren(cert, wrap); // Extensions ::= SEQUENCE OF Extension
    if (!seq || seq.tag !== 0x30) return out;
    for (const ext of derChildren(cert, seq)) {
      if (ext.tag !== 0x30) continue;
      const parts = derChildren(cert, ext); // { extnID OID, critical BOOLEAN?, extnValue OCTET STRING }
      const value = parts[parts.length - 1];
      if (!parts[0] || parts[0].tag !== 0x06 || !value || value.tag !== 0x04) continue;
      const oid = decodeOid(cert, parts[0]);
      if (oid === '2.5.29.17') { // subjectAltName: GeneralNames SEQUENCE
        const names = derTlv(cert, value.contentStart);
        if (names.tag !== 0x30 || names.end > value.end) continue;
        for (const gn of derChildren(cert, names)) {
          if (gn.tag === 0x81) out.sanEmails.push(td.decode(cert.slice(gn.contentStart, gn.end))); // rfc822Name (IA5String)
        }
      } else if (oid === '2.5.29.19') { // basicConstraints: SEQUENCE { cA BOOLEAN DEFAULT FALSE, … }
        const bc = derTlv(cert, value.contentStart);
        if (bc.tag !== 0x30 || bc.end > value.end) continue;
        const [ca] = derChildren(cert, bc);
        out.isCa = !!ca && ca.tag === 0x01 && ca.end > ca.contentStart && cert[ca.contentStart] !== 0;
      }
    }
  } catch { /* a malformed extension block never breaks certificate display */ }
  return out;
}

export interface ParsedCertificate {
  subject: DName;
  issuer: DName;
  notBefore: Date;
  notAfter: Date;
  selfSigned: boolean;
  spki: Uint8Array;
  tbsBytes: Uint8Array;
  signatureRaw: Uint8Array | null;
  sigAlg: CertSigAlg | null;
  issuerBytes: Uint8Array;
  subjectBytes: Uint8Array;
  sanEmails: string[];
  isCa: boolean;
}

// How an ISSUER signed a child's tbsCertificate. Real C2PA hierarchies span
// ECDSA (Google, the camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft,
// DigiCert, SSL.com roots), RSA-PSS, and Ed25519 (Trufo). The digest is fixed
// by the OID for ECDSA/RSA; RSA-PSS carries it in the AlgorithmIdentifier
// parameters. Read from the CHILD cert (it names the algorithm the parent used).
export type CertSigAlg =
  | { scheme: 'ecdsa'; hash: string }
  | { scheme: 'rsa'; hash: string }
  | { scheme: 'rsa-pss'; hash: string; saltLength: number }
  | { scheme: 'ed25519' };

// signatureAlgorithm OID (hex of the OID content) → fixed-digest schemes.
const SIG_ALGS: Record<string, { scheme: 'ecdsa' | 'rsa'; hash: string }> = {
  '2a8648ce3d040302': { scheme: 'ecdsa', hash: 'SHA-256' }, // ecdsa-with-SHA256
  '2a8648ce3d040303': { scheme: 'ecdsa', hash: 'SHA-384' }, // ecdsa-with-SHA384
  '2a8648ce3d040304': { scheme: 'ecdsa', hash: 'SHA-512' }, // ecdsa-with-SHA512
  '2a864886f70d01010b': { scheme: 'rsa', hash: 'SHA-256' }, // sha256WithRSAEncryption
  '2a864886f70d01010c': { scheme: 'rsa', hash: 'SHA-384' }, // sha384WithRSAEncryption
  '2a864886f70d01010d': { scheme: 'rsa', hash: 'SHA-512' }, // sha512WithRSAEncryption
};
const SIG_OID_RSA_PSS = '2a864886f70d01010a'; // id-RSASSA-PSS
const SIG_OID_ED25519 = '2b6570';             // id-Ed25519
const HASH_OIDS: Record<string, string> = {
  '608648016503040201': 'SHA-256', '608648016503040202': 'SHA-384',
  '608648016503040203': 'SHA-512', '2b0e03021a': 'SHA-1',
};
const HASH_LEN: Record<string, number> = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };

// Parse a signatureAlgorithm AlgorithmIdentifier into a verify recipe, or null
// for anything unrecognised (→ the chain step is a quiet no-match, never a
// crash, never a false trust).
function parseCertSigAlg(cert: Uint8Array, algId: DerTlv): CertSigAlg | null {
  try {
    const kids = derChildren(cert, algId);
    const oidTlv = kids[0];
    if (!oidTlv || oidTlv.tag !== 0x06) return null;
    const oid = hexOf(cert.slice(oidTlv.contentStart, oidTlv.end));
    const fixed = SIG_ALGS[oid];
    if (fixed) return { ...fixed };
    if (oid === SIG_OID_ED25519) return { scheme: 'ed25519' };
    if (oid === SIG_OID_RSA_PSS) {
      // RSASSA-PSS-params ::= SEQUENCE { [0] hashAlgorithm, [1] maskGen,
      // [2] saltLength INTEGER DEFAULT 20, [3] trailerField }. Absent [0]/[2]
      // fall back to the ASN.1 defaults (SHA-1, 20).
      let hash = 'SHA-1';
      let saltLength = 20;
      const params = kids[1];
      if (params && params.tag === 0x30) {
        for (const field of derChildren(cert, params)) {
          if (field.tag === 0xa0) {
            const h = derChildren(cert, field)[0];
            if (h && h.tag === 0x06) hash = HASH_OIDS[hexOf(cert.slice(h.contentStart, h.end))] || hash;
          } else if (field.tag === 0xa2) {
            const s = derChildren(cert, field)[0];
            if (s && s.tag === 0x02) { let n = 0; for (const b of cert.slice(s.contentStart, s.end)) n = n * 256 + b; saltLength = n; }
          }
        }
      }
      return { scheme: 'rsa-pss', hash, saltLength };
    }
    return null;
  } catch { return null; }
}

/** Pull display facts + the SPKI out of a DER certificate. */
export function parseCertificate(cert: Uint8Array): ParsedCertificate {
  const top = derTlv(cert, 0);
  // Certificate: tbsCertificate, signatureAlgorithm, signatureValue BIT STRING.
  const topKids = derChildren(cert, top);
  const tbs = topKids[0]!;
  const sigAlgTlv = topKids[1];
  const sigTlv = topKids[2];
  const kids = derChildren(cert, tbs);
  // tbsCertificate: optional [0] version, serial, sigAlg, issuer, validity, subject, SPKI, …
  const shift = kids[0]!.tag === 0xa0 ? 1 : 0;
  const issuerTlv = kids[shift + 2]!;
  const validity = derChildren(cert, kids[shift + 3]!);
  const subjectTlv = kids[shift + 4]!;
  const spkiTlv = kids[shift + 5]!;
  const issuerBytes = cert.slice(issuerTlv.start, issuerTlv.end);
  const subjectBytes = cert.slice(subjectTlv.start, subjectTlv.end);
  const ext = decodeExtensions(cert, kids, shift);
  return {
    subject: decodeName(cert, subjectTlv),
    issuer: decodeName(cert, issuerTlv),
    notBefore: decodeTime(cert, validity[0]!),
    notAfter: decodeTime(cert, validity[1]!),
    selfSigned: hexOf(issuerBytes) === hexOf(subjectBytes),
    spki: cert.slice(spkiTlv.start, spkiTlv.end),
    // Additive (1.11.0) - the chain-verification raw material. signatureRaw is
    // the signatureValue BIT STRING content minus its unused-bits byte: for
    // ECDSA that is still a DER ECDSA-Sig-Value (ecdsaDerToRaw converts).
    tbsBytes: cert.slice(tbs.start, tbs.end),
    signatureRaw: sigTlv && sigTlv.tag === 0x03 && sigTlv.end > sigTlv.contentStart + 1
      ? cert.slice(sigTlv.contentStart + 1, sigTlv.end)
      : null,
    sigAlg: sigAlgTlv ? parseCertSigAlg(cert, sigAlgTlv) : null,
    issuerBytes,
    subjectBytes,
    sanEmails: ext.sanEmails,
    isCa: ext.isCa,
  };
}

// ─── trust-anchor chain verification ──────────────────────────────────────────
// ecdsaDerToRaw (the inverse of der-read.ts's ecdsaRawToDer) and the EC
// named-curve table both live in der-read.ts, shared with seal.ts.

// Read the named curve out of an EC SubjectPublicKeyInfo (SEQUENCE {
// AlgorithmIdentifier { ecPublicKey, curveOID }, BIT STRING }). A non-EC key
// (RSA root) or an unknown curve returns null → the step is a quiet no-match,
// so an RSA-rooted signer stays honestly untrusted rather than crashing.
function ecParamsOf(spki: Uint8Array): { curve: string; hash: string; size: number } | null {
  try {
    const algId = derChildren(spki, derTlv(spki, 0))[0]!;
    const curveOid = derChildren(spki, algId)[1];
    if (!curveOid || curveOid.tag !== 0x06) return null;
    return EC_CURVES[hexOf(spki.slice(curveOid.contentStart, curveOid.end))] ?? null;
  } catch { return null; }
}

// One issuer→subject step: the child's issuer Name must byte-match the signer's
// subject AND the signature over the child's tbsCertificate must verify against
// the signer's SPKI, under the algorithm the CHILD's signatureAlgorithm names.
// Covers every scheme real C2PA CAs sign certificates with - ECDSA P-256/384/521
// (Google, camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft, DigiCert, SSL.com),
// RSA-PSS, and Ed25519 (Trufo). An unrecognised algorithm, a key that can't be
// imported for it, or any thrown error is a quiet no-match: a signer we cannot
// cryptographically verify stays honestly UNTRUSTED - never a false trust.
export async function signedBy(child: ParsedCertificate, signer: ParsedCertificate): Promise<boolean> {
  if (!child.signatureRaw || !child.sigAlg || hexOf(child.issuerBytes) !== hexOf(signer.subjectBytes)) return false;
  const sa = child.sigAlg;
  try {
    if (sa.scheme === 'ecdsa') {
      const ec = ecParamsOf(signer.spki);
      if (!ec) return false;
      const key = await subtle.importKey('spki', asBufferSource(signer.spki), { name: 'ECDSA', namedCurve: ec.curve }, false, ['verify']);
      return await subtle.verify({ name: 'ECDSA', hash: sa.hash }, key, asBufferSource(ecdsaDerToRaw(child.signatureRaw, ec.size)), asBufferSource(child.tbsBytes));
    }
    if (sa.scheme === 'rsa') {
      const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(signer.spki)), { name: 'RSASSA-PKCS1-v1_5', hash: sa.hash }, false, ['verify']);
      return await subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
    }
    if (sa.scheme === 'rsa-pss') {
      const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(signer.spki)), { name: 'RSA-PSS', hash: sa.hash }, false, ['verify']);
      return await subtle.verify({ name: 'RSA-PSS', saltLength: sa.saltLength }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
    }
    // Ed25519 - the raw 64-byte signature verifies directly; not universal in
    // WebCrypto, so a missing implementation throws → quiet no-match.
    const key = await subtle.importKey('spki', asBufferSource(signer.spki), { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
  } catch { return false; }
}

// Does the x5chain reach a pinned root? Walks leaf → intermediates (the rest of
// the embedded x5chain) → a caller-pinned anchor, verifying each issuer→subject
// signature and requiring every intermediate to be basicConstraints CA:TRUE (or
// any issued leaf could vouch for a forged identity). Real Adobe / Microsoft /
// OpenAI chains carry more than one intermediate, so the walk is not depth-1.
// Guards: intermediates are consumed at most once (no A→B→A loops); the anchor
// is only ever the PINNED cert, never a root the chain ships for itself.
//
// DoS bound: the walk re-scans not-yet-used intermediates each hop, so an
// attacker x5chain of N same-subject CA certs would cost O(N²) serial WebCrypto
// verifications (minutes of pinned CPU) - verifyC2pa must never hang. So only
// the first MAX_CHAIN_INTERMEDIATES are ever parsed/considered; real C2PA chains
// are ≤ ~4–6 deep, far under the cap, while a hostile chain is bounded to a
// trivial O(cap²). Hostile chains must never crash: every parse/import/verify
// failure is a quiet no-match. → the anchor, or null.
const MAX_CHAIN_INTERMEDIATES = 8;
async function chainsToAnchor(leaf: ParsedCertificate, chainDers: unknown[], trustAnchors: Uint8Array[]): Promise<ParsedCertificate | null> {
  const anchors: ParsedCertificate[] = [];
  for (const der of trustAnchors) { try { anchors.push(parseCertificate(der)); } catch { /* skip malformed anchor */ } }
  const intermediates: ParsedCertificate[] = [];
  // Slice BEFORE parsing so a giant x5chain can't even force N cert parses.
  for (const der of chainDers.slice(1, 1 + MAX_CHAIN_INTERMEDIATES)) {
    if (der instanceof Uint8Array) { try { const c = parseCertificate(der); if (c.isCa) intermediates.push(c); } catch { /* skip */ } }
  }
  let current = leaf;
  const used = new Set<ParsedCertificate>();
  // At most (intermediates + 1) hops: each iteration either reaches an anchor or
  // climbs one fresh intermediate; if neither, the chain is broken.
  for (let hop = 0; hop <= intermediates.length; hop++) {
    for (const anchor of anchors) {
      try { if (await signedBy(current, anchor)) return anchor; } catch { /* not this anchor */ }
    }
    let next: ParsedCertificate | null = null;
    for (const mid of intermediates) {
      if (used.has(mid) || hexOf(mid.subjectBytes) !== hexOf(current.issuerBytes)) continue;
      try { if (await signedBy(current, mid)) { next = mid; break; } } catch { /* try next intermediate */ }
    }
    if (!next) break;
    used.add(next);
    current = next;
  }
  return null;
}

// ─── verification ─────────────────────────────────────────────────────────────

type CoseAlg =
  | { kind: 'ecdsa'; curve: string; hash: string; name: string }
  | { kind: 'rsa-pss'; hash: string; saltLength: number; name: string }
  | { kind: 'ed25519'; name: string };

// COSE alg id → WebCrypto parameters. ECDSA covers our own writer; RSA-PSS
// and Ed25519 cover the certs real-world (Adobe et al.) manifests ship with.
const COSE_ALGS: Record<string, CoseAlg> = {
  '-7': { kind: 'ecdsa', curve: 'P-256', hash: 'SHA-256', name: 'ES256' },
  '-35': { kind: 'ecdsa', curve: 'P-384', hash: 'SHA-384', name: 'ES384' },
  '-36': { kind: 'ecdsa', curve: 'P-521', hash: 'SHA-512', name: 'ES512' },
  '-37': { kind: 'rsa-pss', hash: 'SHA-256', saltLength: 32, name: 'PS256' },
  '-38': { kind: 'rsa-pss', hash: 'SHA-384', saltLength: 48, name: 'PS384' },
  '-39': { kind: 'rsa-pss', hash: 'SHA-512', saltLength: 64, name: 'PS512' },
  '-8': { kind: 'ed25519', name: 'Ed25519' },
};

// id-RSASSA-PSS AlgorithmIdentifier OID (1.2.840.113549.1.1.10). WebCrypto
// only imports RSA SPKIs declared as plain rsaEncryption, so a PSS-declared
// SPKI (what C2PA test/production certs actually carry) is re-wrapped: same
// key BIT STRING, rsaEncryption + NULL params AlgorithmIdentifier.
const OID_RSASSA_PSS = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a);
const ALGID_RSA_ENCRYPTION = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);

function derWrap(tag: number, body: Uint8Array): Uint8Array {
  let head: Uint8Array;
  if (body.length < 0x80) head = Uint8Array.of(tag, body.length);
  else if (body.length < 0x100) head = Uint8Array.of(tag, 0x81, body.length);
  else head = Uint8Array.of(tag, 0x82, body.length >>> 8, body.length & 0xff);
  return concatBytes([head, body]);
}

function normalizeRsaSpki(spki: Uint8Array): Uint8Array {
  const top = derTlv(spki, 0);
  const [algTlv, keyTlv] = derChildren(spki, top);
  const oid = derTlv(spki, algTlv!.contentStart);
  const oidBytes = spki.slice(oid.start, oid.end);
  if (oidBytes.length !== OID_RSASSA_PSS.length || !oidBytes.every((b, i) => b === OID_RSASSA_PSS[i])) return spki;
  return derWrap(0x30, concatBytes([ALGID_RSA_ENCRYPTION, spki.slice(keyTlv!.start, keyTlv!.end)]));
}

async function verifyCoseSignature(alg: CoseAlg, spki: Uint8Array, sigRaw: Uint8Array, sigStructure: Uint8Array): Promise<boolean> {
  if (alg.kind === 'ecdsa') {
    const key = await subtle.importKey('spki', asBufferSource(spki), { name: 'ECDSA', namedCurve: alg.curve }, false, ['verify']);
    return subtle.verify({ name: 'ECDSA', hash: alg.hash }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
  }
  if (alg.kind === 'rsa-pss') {
    const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(spki)), { name: 'RSA-PSS', hash: alg.hash }, false, ['verify']);
    return subtle.verify({ name: 'RSA-PSS', saltLength: alg.saltLength }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
  }
  // Ed25519 - not yet universal in WebCrypto; the caller reports a clear
  // "cannot verify on this device" when importKey/verify throws.
  const key = await subtle.importKey('spki', asBufferSource(spki), { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
}

const HASHED_URI_PREFIX = 'self#jumbf=c2pa.assertions/';

export interface C2paCheck { code: string; ok: boolean; explanation: string; }

// Lolly's own ephemeral credential names itself (x509.ts's SIGNER_CN). Matching it is
// what lets the untrusted row stay specific: see untrustedReason.
const EPHEMERAL_CN = 'Lolly On-Device Credential';

/**
 * Why a signer is untrusted - THREE different facts, and conflating them was fine only
 * while every unanchored file really was one of ours.
 *
 * An enrolled identity (the CLI's `--sign-key`, the browser's CA enrolment) can produce
 * a CA-ISSUED certificate that simply chains to no anchor THIS verifier pinned, or a
 * self-signed one an operator distributes as its own root. Telling either reader "an
 * ephemeral on-device key" is false, and points them at the wrong fix. So: read the
 * leaf, and only claim the ephemeral case when the certificate is literally ours.
 */
/**
 * Unpick a Dublin Core creator entry written npm-style - `Name <email> (site)`,
 * either part optional - back into structured fields. A plain name (or any
 * string that doesn't match the conventions) comes back as just { name }, so
 * third-party creator strings are never mangled.
 */
function parseCreatorEntry(entry: string): { name: string; email?: string; url?: string } {
  let name = entry;
  const em = name.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (em) name = name.replace(em[0], '');
  const ur = name.match(/\(([^()\s]+\.[^()\s]+)\)/);
  if (ur) name = name.replace(ur[0], '');
  name = name.replace(/\s+/g, ' ').trim();
  // A contact-only entry ("<a@b.c>") still needs a non-empty name - reuse the
  // contact itself rather than inventing one.
  if (!name) name = em?.[1] ?? ur?.[1] ?? entry.trim();
  return { name, ...(em ? { email: em[1] } : {}), ...(ur ? { url: ur[1] } : {}) };
}

function untrustedReason(signer: C2paSigner | undefined): string {
  if (signer?.selfSigned === false) return 'signing certificate untrusted - a CA-issued certificate that chains to no pinned trust anchor (pin its root to verify the identity)';
  if (signer && signer.commonName !== EPHEMERAL_CN) return 'signing certificate untrusted - a self-signed certificate, which vouches only for itself (pin it as a trust anchor to verify the identity)';
  return 'signing certificate untrusted - an ephemeral on-device key, not a CA-issued identity';
}
export interface C2paSignerIdentity { email: string | null; issuer: string | undefined; }
export interface C2paSigner {
  commonName: string | undefined;
  organization: string | undefined;
  notBefore: string;
  notAfter: string;
  selfSigned: boolean;
  alg: string;
  identity?: C2paSignerIdentity;
}
export interface C2paClaim {
  title: unknown;
  format: unknown;
  claimGenerator: unknown;
  generatorInfo: Record<string, string | number | boolean> | null;
  instanceId: unknown;
  manifestLabel: string;
  actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; parameters?: unknown }>;
}
// A file's provenance flagged as AI/ML-generated: `generated` = pixels produced
// wholly by a trained model, `composite` = a human work with AI-generated parts
// mixed in. `sourceType` is the raw IPTC DigitalSourceType URI it was read from.
export interface C2paAiOrigin {
  kind: 'generated' | 'composite';
  sourceType: string;
}
// One recorded provenance step - a C2PA action from any manifest in the chain.
// `generator` is the claim_generator(_info) of the manifest that RECORDED this
// step - the "who did it" the view renders as a software pill (softwareAgent, a
// per-action field many writers omit, takes precedence when present).
// `parameters` is the action's raw CBOR parameters value (a Map when written by
// our own encoder) - surfaced so a reader can recover machine-readable context a
// writer recorded on a step, e.g. the TTS script a synthetic-voice clip was
// generated from ({ script, voice, model, lang } on its c2pa.created action).
export interface C2paHistoryStep { action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; parameters?: unknown; generator?: unknown; }

/**
 * section 18.28 `c2pa.ai-disclosure` - the claim generator's own machine-readable AI
 * transparency statement, read for EVERY format (this is not a text-binding
 * feature; it upgrades existing image/video verification the day any generator
 * adopts it).
 *
 * Read LIBERALLY and NEVER as a failure: the CDDL requires `modelType`, but a
 * writer that omits it - or that ships one of the fields the CDDL still has
 * commented out as pending - must not turn a good file into a broken one. Every
 * field is optional here, unknown keys are ignored, and a malformed assertion
 * leaves `report.aiDisclosure` absent rather than emitting a check row.
 *
 * Like every other claim fact this is SELF-ASSERTED: it says what the signer
 * declared, not what a model actually did. `oversight` is
 * `contentProfile.humanOversightLevel` (section 18.28.4:
 * fully_autonomous / prompt_guided / human_validated), lifted to the top level
 * because it is the only field of that sub-map the spec defines.
 */
export interface C2paAiDisclosure {
  modelType?: string;
  modelName?: string;
  modelIdentifier?: string;
  oversight?: string;
  /** arXiv taxonomy terms. The CDDL says a list; section 18.28.4's own example ships a
   *  bare string, so both are accepted and normalized to a list. */
  scientificDomain?: string[];
}

/** Which C2PA 2.4 text binding carried (or merely referenced) the credential. */
export type C2paTextBindingKind = 'html' | 'structuredText' | 'text';

/**
 * The text-binding posture, present ONLY for the three 2.4 text formats.
 *
 * Its whole job is to keep "there is no credential here" distinguishable from
 * the several ways a text carrier can be present and unusable - a truncated
 * paste, a document with two manifest elements, a reference to a manifest that
 * lives on someone else's server. Each of those also emits a failed check row
 * with the spec's own status code; this record is the machine-readable detail a
 * surface needs to write the honest sentence.
 */
export interface C2paTextBinding {
  kind: C2paTextBindingKind;
  /** The extraction status (C2PA_TEXT_STATUS) when the carrier is present but
   *  unusable - the spec's own code where it defines one. */
  status?: string;
  /** Human-readable specifics for `status`. */
  detail?: string;
  /** section A.7.1.2 `<link rel="c2pa-manifest">` / section A.9.3 URL reference. THE ENGINE
   *  NEVER FETCHES: this is handed up so the shell can resolve it under its own
   *  network policy, which is why the row reads `manifest.inaccessible` and not
   *  "no credential". */
  manifestUrl?: string;
  /** The store used for this report came from `verifyC2pa`'s `externalManifest`
   *  option, not from the asset - i.e. the caller resolved `manifestUrl` itself.
   *  A `state: 'valid'` report with this set means "these bytes match a
   *  credential fetched from elsewhere", which is NOT "the credential inside
   *  this document is intact". Absent on every embedded-credential report. */
  externalManifestUsed?: boolean;
  /** section A.8: how many C2PATextManifestWrappers the asset holds… */
  wrappers?: number;
  /** …and how many of them the assertion's exclusions actually selected
   *  (section 15.12.1.3.1 step 2: 0 → malformed, >1 → multipleWrappers). */
  matchedWrappers?: number;
  /** The wrapper walk stopped at its cap, so `wrappers` is a floor, not a count
   * - and "no wrapper matches this exclusion" may only mean "we stopped
   *  looking". Absent on every asset within the cap. */
  wrappersTruncated?: boolean;
  /** section A.8.4.1: which wrapper (1-based, in document order) the assertion's own
   *  exclusions selected, when there was more than one to choose from. Absent on
   *  the ordinary single-wrapper asset. */
  selectedWrapper?: number;
  /**
   * section A.7.1.3 / section A.9.4 say the exclusion "shall" cover exactly the carrier. Set
   * when it does not - and the two ways it can differ are not the same fact:
   *
   *   'other'    the exclusion reaches OUTSIDE the carrier, so bytes the
   *              credential does not cover are being carved out of the hash.
   *              That is the forgery shape, and it fails the report.
   *   'narrower' the exclusion is INSIDE the carrier, so the carrier's own bytes
   *              are in the hash - non-conforming, but strictly more strongly
   *              bound, not less. Reported, never accused.
   *
   * Absent when the exclusion conforms (including under section A.9.4's alternate
   * end-of-file readings).
   */
  exclusionsConform?: 'narrower' | 'other';
  /**
   * section 15.12.1.3.4 - this looks like a FRAGMENT of a larger signed text, not an
   * edit of a whole one. Set on the two machine-derivable partial-copy shapes:
   * a wrapper whose magic decoded but whose body ran out of selectors, and an
   * exclusion range that points past the end of the text we were given. Both
   * mean the signed original was longer than this copy.
   */
  fragment?: boolean;
  /** section A.8's unresolved boundary question, answered per asset: whether the
   *  assertion excluded the U+FEFF prefix ('wrapper') or started at the first
   *  variation selector ('selectors'). Both are accepted - see the
   *  section 15.12.1.3.1 block in verifyC2pa for why neither is the looser reading. */
  exclusionsFrom?: 'wrapper' | 'selectors';
}

export interface C2paReport {
  found: boolean;
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  // The active manifest is NOT a (likely) Lolly creation, but the intact
  // credential's preserved provenance chain records Lolly steps - a Lolly
  // export later opened/edited/re-signed by another tool. Credits the Lolly
  // leg without claiming the whole file.
  partsMadeWithLolly: boolean;
  delivered: boolean;
  format: SniffFormat | null;
  checks: C2paCheck[];
  reason?: string;
  claim?: C2paClaim;
  // Scalar export-context keys (tool/surface/engine/os/date/dimensions…) plus an
  // optional nested `inputs` digest (id → short string) - the scalar inputs the
  // asset was rendered from, recorded by the writer's tools.lolly.export assertion.
  environment?: (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
  author?: { name: string; email?: string; url?: string };
  // User-asserted copyright + licence, read back from the credential's own
  // metadata (v2 cawg.metadata dc:rights; v1 CreativeWork copyrightNotice/license).
  rights?: string;
  signer?: C2paSigner;
  aiGenerated?: C2paAiOrigin;
  // section 18.28 c2pa.ai-disclosure, read for every format. Self-asserted claim
  // content, liberal read, never a failure - see C2paAiDisclosure.
  aiDisclosure?: C2paAiDisclosure;
  // Every disclosure when the claim made MORE THAN ONE (a pipeline that used
  // two models and disclosed both, labelled `c2pa.ai-disclosure__1`, `__2`).
  // `aiDisclosure` is always the first of these; this field is absent on the
  // ordinary single-model claim.
  aiDisclosures?: C2paAiDisclosure[];
  // The C2PA specification version the claim generator declared it wrote to
  // (SemVer, e.g. "2.4.0"). 2.4 moved this from the claim into
  // claim_generator_info; the deprecated claim-level field is still read.
  // section 10.2.3.1: "validators should treat this field as purely informational and
  // should not change their validation logic based on this value" - so nothing
  // here branches on it.
  specVersion?: string;
  // Present only for the C2PA 2.4 text bindings (html/code/text formats).
  textBinding?: C2paTextBinding;
  // The full provenance chain - every manifest's actions (parent/ingredient →
  // active), flattened in store order with adjacent duplicates collapsed.
  history?: C2paHistoryStep[];
}

// ─── C2PA 2.4 text bindings: read-side helpers ────────────────────────────────

/** sniffed format → which appendix binding it is. Absent = an ordinary binary
 *  container, which keeps the pre-2.4 extraction path byte-for-byte. */
const TEXT_BINDING_KIND: Partial<Record<SniffFormat, C2paTextBindingKind>> = {
  html: 'html',
  code: 'structuredText',
  text: 'text',
};

/**
 * An extraction status → the check code a report row carries.
 *
 * The spec defines a status code for most of these; where it does not (a
 * base64 payload that isn't base64, a `<script>` with no closing tag, an asset
 * past the reader's size cap) the row falls back to `credential.unreadable`,
 * which is exactly what those are, and the precise state stays visible in
 * `report.textBinding.status`.
 */
function textStatusCheck(kind: C2paTextBindingKind, status: string): string {
  switch (status) {
    case C2PA_TEXT_STATUS.htmlMultipleManifests: return C2PA_CHECK.manifestHtmlMultipleManifests;
    case C2PA_TEXT_STATUS.structuredTextMultipleReferences: return C2PA_CHECK.manifestStructuredTextMultipleReferences;
    case C2PA_TEXT_STATUS.structuredTextEmptyReference: return C2PA_CHECK.manifestStructuredTextEmptyReference;
    case C2PA_TEXT_STATUS.textCorruptedWrapper: return C2PA_CHECK.manifestTextCorruptedWrapper;
    case C2PA_TEXT_STATUS.textMultipleWrappers: return C2PA_CHECK.manifestTextMultipleWrappers;
    // section A.9.5 names this one; section A.7 names none for a bad href, so an HTML link we
    // refuse to hand a fetcher reads as "the remote manifest was not obtained".
    case C2PA_TEXT_STATUS.unsupportedReference:
      return kind === 'structuredText'
        ? C2PA_CHECK.manifestStructuredTextMalformedReference
        : C2PA_CHECK.manifestInaccessible;
    default: return C2PA_CHECK.credentialUnreadable;
  }
}

/**
 * section 15.12.1.3.4 - is this wrapper the shape a PARTIAL COPY leaves behind?
 *
 * True when the magic decoded (so a wrapper really was here) but the body did
 * not: the selector run, or the text, ran out before the declared manifest did.
 * Deliberately NOT true for an unsupported VERSION - a v2 wrapper may be
 * perfectly complete and simply newer than this verifier, and telling that
 * reader "your text looks truncated" would be a guess dressed as a finding.
 * Version 0 is the "ran out before the version byte" sentinel, so it counts.
 */
const isCutWrapper = (w: C2paTextWrapper): boolean =>
  w.store === null && w.status === C2PA_TEXT_STATUS.textCorruptedWrapper && (w.version === 1 || w.version === 0);

/** Does this exclusion name this wrapper, under either section A.8 boundary reading? */
const excludesWrapper = (e: C2paExclusion, w: C2paTextWrapper): boolean =>
  (e.start === w.start && e.length === w.end - w.start)
  || (e.start === w.selectorStart && e.length === w.end - w.selectorStart);

/** How many candidate stores a multi-wrapper text is worth parsing. section A.8.4.1
 *  expects ONE; more than a couple is already a hostile shape. */
const MAX_WRAPPER_CANDIDATES = 8;

/**
 * section A.8.4.1 + section 15.12.1.3.1 steps 1–2: when a text carries MORE THAN ONE wrapper,
 * the assertion's exclusions choose which one binds this copy.
 *
 * section A.8.4.1, verbatim: "Validators may encounter multiple wrappers; selection of
 * the intended wrapper is governed by the exclusions field of the c2pa.hash.data
 * assertion." Extraction cannot do that - it has no assertion yet - so it hands
 * back the first valid wrapper and the selection happens here, by asking each
 * candidate's OWN store which range it signed and keeping the one that names
 * itself.
 *
 * The case this exists for is a re-signed text: sign, edit, re-sign by appending
 * a new wrapper without removing the stale one - spec-legal (the new signer
 * hashes everything except its own wrapper, stale wrapper included) and exactly
 * what "validators may encounter multiple wrappers" anticipates. Taking the
 * first wrapper instead reported an intact credential as INVALID *and* printed
 * the stale manifest's claim - its title, its signer, its date - as facts about
 * the current text.
 *
 * → the wrapper whose store's exclusions name it, or null to keep extraction's
 * answer (which is also what a forged "select me" store gets: the hard binding
 * still has to pass over the real bytes).
 */
function selectWrapperByExclusions(carrier: C2paTextCarrier): C2paTextWrapper | null {
  const valid = carrier.wrappers.filter((w) => w.store);
  if (valid.length < 2) return null;
  for (const w of valid.slice(0, MAX_WRAPPER_CANDIDATES)) {
    try {
      const hd = parseC2paStore(w.store!).assertions.find((a) => a.label === 'c2pa.hash.data');
      if (!hd) continue;
      const decoded = decodeCbor(hd.content);
      if (!(decoded instanceof Map)) continue;
      if (readExclusions(decoded).some((e) => excludesWrapper(e, w))) return w;
    } catch { /* an unparseable candidate simply is not the selected one */ }
  }
  return null;
}

/** The declared exclusions of a c2pa.hash.data assertion, structurally
 *  validated (integers only) and sorted. A crafted assertion can put anything
 *  in here, so every field is checked before it is used as an offset. */
function readExclusions(hd: Map<unknown, unknown>): C2paExclusion[] {
  const raw = hd.get('exclusions');
  return (Array.isArray(raw) ? raw : [])
    .map((e) => ({
      start: (e instanceof Map ? e.get('start') : undefined) as number,
      length: (e instanceof Map ? e.get('length') : undefined) as number,
    }))
    .sort((a, b) => a.start - b.start);
}

/**
 * section A.7.1.3 / section A.9.4 conformance: an HTML document's or a structured-text file's
 * `c2pa.hash.data` "shall include a SINGLE exclusion range covering the entire
 * element/block". Compare what the assertion declares against the range the
 * document's own bytes say the carrier occupies.
 *
 * TWO DIFFERENT FACTS, and one message for both was a factual inversion. These
 * bindings hash raw bytes at absolute offsets with no canonicalisation, so every
 * byte outside the exclusion is bound - that is the entire guarantee.
 *
 *   'other'    the declared range reaches OUTSIDE the carrier. That IS a hole in
 *              the guarantee: a signed page could carve out a paragraph and
 *              still verify "intact". Refused, with
 *              assertion.dataHash.additionalExclusionsPresent - the code section 15.2.2
 *              defines as "exclusion ranges other than the C2PA Manifest Store".
 *   'narrower' the declared range sits INSIDE the carrier, so the carrier's own
 *              bytes are part of the hash - which is Lolly's own SVG placer
 *              convention (c2pa-containers.ts placeSvg), and it binds the file
 *              MORE strongly, not less. Nothing additional was excluded, so the
 *              additionalExclusions code was wrong, and "content outside the
 *              credential is not covered by the binding" said the opposite of
 *              what the file shows. Reported as non-conformance, never accused.
 *
 * Either way the hash now RUNS: short-circuiting it meant a non-conforming file
 * could not be told apart from a changed one, and section A.9.4's end-of-file rule is
 * one byte ambiguous (CRLF, trailing blank line - see armorExclusion), so a
 * conformant producer on the other reading got an accusation instead of a
 * result. `alternates` carry those equally-valid readings.
 *
 * NEVER applies to binary containers (the existing walker keeps its behaviour
 * byte-for-byte) nor to section A.8 text, whose exclusions are checked against real
 * wrapper boundaries by the text pipeline instead.
 */
const sameRanges = (a: C2paExclusion[], b: C2paExclusion[]): boolean =>
  a.length === b.length && a.every((x, i) => x.start === b[i]!.start && x.length === b[i]!.length);

function htmlCodeExclusionConformance(
  binding: C2paTextBinding | undefined,
  advisory: C2paExclusion[] | null,
  alternates: C2paExclusion[][] | null,
  declared: C2paExclusion[],
): { kind: 'narrower' | 'other'; message: string } | null {
  if (!binding || binding.kind === 'text' || !advisory) return null;
  const want = [...advisory].sort((a, b) => a.start - b.start);
  const readings = [want, ...(alternates ?? []).map((a) => [...a].sort((x, y) => x.start - y.start))];
  if (readings.some((r) => sameRanges(r, declared))) return null;
  // Every declared byte inside some conformant reading of the carrier → nothing
  // extra was excluded; the difference is narrowness, not a carve.
  const inside = declared.every((d) =>
    readings.some((r) => r.some((w) => d.start >= w.start && d.start + d.length <= w.start + w.length)));
  const shown = (list: C2paExclusion[]): string =>
    list.length ? list.map((e) => `${e.start}+${e.length}`).join(', ') : 'none';
  const where = binding.kind === 'html'
    ? 'the <script type="application/c2pa"> element (section A.7.1.3)'
    : 'the -----BEGIN/END C2PA MANIFEST----- block (section A.9.4)';
  return inside
    ? {
      kind: 'narrower',
      message: `the data hash excludes ${shown(declared)}, inside ${where} at ${shown(want)} - narrower than the spec requires, so the carrier's own bytes are part of the hash`,
    }
    : {
      kind: 'other',
      message: `the data hash excludes ${shown(declared)} but ${where} occupies ${shown(want)} - content outside the credential is not covered by the binding`,
    };
}

/**
 * section 18.28, liberal read. Returns undefined for anything that isn't a map with at
 * least one field we recognise; never throws, never fails a report.
 */
function readAiDisclosure(content: Uint8Array): C2paAiDisclosure | undefined {
  try {
    let m: unknown = decodeCbor(content);
    // The CDDL says CBOR, but a JSON-serialized copy is cheap to tolerate and a
    // reader that refused one would be reporting "no disclosure" about a file
    // that made one.
    if (!(m instanceof Map)) {
      const json = JSON.parse(td.decode(content)) as Record<string, unknown>;
      m = json && typeof json === 'object' && !Array.isArray(json) ? new Map(Object.entries(json)) : null;
    }
    if (!(m instanceof Map)) return undefined;
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const profile = m.get('contentProfile');
    const oversight = profile instanceof Map ? str(profile.get('humanOversightLevel'))
      : profile && typeof profile === 'object' ? str((profile as Record<string, unknown>).humanOversightLevel)
        : undefined;
    // The CDDL says a 1+ list; section 18.28.4's own example ships a bare string.
    const rawDomain = m.get('scientificDomain');
    const domains = (Array.isArray(rawDomain) ? rawDomain : [rawDomain])
      .map(str).filter((s): s is string => !!s);
    const out: C2paAiDisclosure = {
      ...(str(m.get('modelType')) ? { modelType: str(m.get('modelType'))! } : {}),
      ...(str(m.get('modelName')) ? { modelName: str(m.get('modelName'))! } : {}),
      ...(str(m.get('modelIdentifier')) ? { modelIdentifier: str(m.get('modelIdentifier'))! } : {}),
      ...(oversight ? { oversight } : {}),
      ...(domains.length ? { scientificDomain: domains } : {}),
    };
    return Object.keys(out).length ? out : undefined;
  } catch { return undefined; }
}


/**
 * Verify a file's Content Credentials entirely on-device. Sniffs the
 * container (pdf/png/jpeg/gif/svg/tiff/webp) from magic bytes.
 *
 * opts.trustAnchors - Uint8Array[] of pinned root-certificate DER. When given,
 * the claim signature's full x5chain is checked against each anchor
 * (issuer-name bytes + ECDSA P-256/SHA-256 over the tbsCertificate, directly
 * or through one CA:TRUE intermediate). Zero-options behaviour is unchanged.
 *
 * `externalManifest` is the ONLY way a manifest that is not inside `bytes` can
 * be verified, and it exists because section A.7.1.2 / section A.9.3 let a text asset point at
 * its credential instead of carrying it. THE ENGINE STILL NEVER FETCHES: the
 * caller resolves the `report.textBinding.manifestUrl` it was handed on a
 * previous (fetch-free) call, under its own network policy, and passes the bytes
 * back in. Only consulted when the asset itself carries no store, so an embedded
 * credential can never be shadowed by a caller-supplied one; when it IS used,
 * `report.textBinding.externalManifestUsed` says so, because "these bytes match
 * a credential served from over there" is a different sentence from "these bytes
 * match the credential inside them".
 *
 * → {
 *     found, state: 'valid'|'invalid'|'none', trusted, reason?,
 *     format:  sniffed container ('png', 'pdf', …) or null,
 *     madeWithLolly: boolean - credential INTACT and records Lolly as generator,
 *     likelyMadeWithLolly: boolean - the claim's own content is trustworthy
 *                (signature verified, every hashed-URI assertion matched) and
 *                records a Lolly creation, but the file's bytes no longer match
 *                the hard binding - a softer verdict for a re-saved/re-encoded
 *                Lolly export; false whenever madeWithLolly is already true,
 *     aiGenerated?: { kind: 'generated'|'composite', sourceType } - set when an
 *                action declares AI/ML-generated pixels (IPTC DigitalSourceType),
 *     history?: the full provenance chain - every manifest's actions flattened,
 *     claim?:  { title, format, claimGenerator, generatorInfo, instanceId, manifestLabel, actions },
 *     environment?: the `tools.lolly.export` assertion's export context,
 *     signer?: { commonName, organization, notBefore, notAfter, selfSigned, alg,
 *                identity? - { email, issuer } once the chain reaches a pinned anchor },
 *     checks:  [{ code, ok, explanation }],
 *   }
 *
 * `state` reflects integrity only: every check except the signingCredential
 * trust row must pass. `trusted` is the identity verdict: true only when the
 * chain reaches a pinned anchor AND the leaf is inside its validity window -
 * anchored-but-expired surfaces `signer.identity` but keeps trusted:false
 * (no timestamp authority yet, so the signing time cannot be proven). With no
 * anchors there is no trust list - a valid report means "this file is exactly
 * what the embedded credential signed", never "a known identity made this";
 * `madeWithLolly` is likewise an integrity-plus-claims statement, not an
 * identity proof.
 */
export async function verifyC2pa(
  bytes: Uint8Array,
  { trustAnchors, externalManifest }: { trustAnchors?: Uint8Array[]; externalManifest?: Uint8Array } = {},
): Promise<C2paReport> {
  if (!(bytes instanceof Uint8Array)) throw new Error('verifyC2pa: bytes must be a Uint8Array');
  const checks: C2paCheck[] = [];
  const fail = (code: string, explanation: string): void => { checks.push({ code, ok: false, explanation }); };
  const pass = (code: string, explanation: string): void => { checks.push({ code, ok: true, explanation }); };
  const format = sniffFormat(bytes);
  const report: C2paReport = { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, delivered: false, format, checks };
  const pdfBytes = bytes; // the hard binding hashes the whole file, any container

  if (!format) {
    // C2PA-scoped, NOT a whole-file verdict: /verify (and MCP) inspect the file
    // for much more - the Lolly Imprint, SEAL, embedded metadata, appended data -
    // so this must never read as "unrecognised / can't inspect", only as "this
    // format doesn't carry Content Credentials".
    report.reason = 'no Content Credentials - these are embedded only in pdf, png, jpg, gif, svg, tiff, webp, avif, mp4, webm, mkv, mp3, wav and ogg files, in HTML documents, and in text carrying a C2PA manifest block or wrapper';
    return report;
  }

  // section A.8's hard binding hashes the NFC-NORMALIZED TEXT, not the bytes handed in,
  // so the text path needs the carrier extraction produced. Null for every other
  // format, which keeps the pre-2.4 path byte-for-byte identical.
  let carrier: C2paTextCarrier | null = null;
  // What section A.7.1.3 / section A.9.4 say this carrier's exclusion SHOULD be, derived from
  // the document itself - the cross-check that keeps a signed HTML page from
  // declaring a hole anywhere other than over its own manifest element.
  let advisoryExclusions: C2paExclusion[] | null = null;
  // Equally-conformant readings of the SAME carrier - section A.9.4's end-of-file
  // newline is one byte ambiguous on a CRLF file and on one with a trailing
  // blank line. A producer on the other reading must get a hash result.
  let advisoryAlternates: C2paExclusion[][] | null = null;
  let extracted: { manifest: Uint8Array } | null;
  const bindingKind = TEXT_BINDING_KIND[format];
  if (bindingKind) {
    // The three 2.4 text bindings. extractC2paDetailed never throws and never
    // fetches; it is the only path that surfaces an external reference, the
    // section A.8 wrapper list, and a present-but-unusable carrier's status - all three
    // of which the legacy `{ manifest } | null | throw` contract cannot carry.
    const detailed = extractC2paDetailed(bytes, format)!;
    carrier = detailed.text ?? null;
    advisoryExclusions = detailed.exclusions ?? null;
    advisoryAlternates = detailed.exclusionAlternates ?? null;
    const binding: C2paTextBinding = { kind: bindingKind };
    report.textBinding = binding;
    if (detailed.externalUrl) binding.manifestUrl = detailed.externalUrl;
    if (carrier) binding.wrappers = carrier.wrappers.length;
    if (carrier?.truncated) binding.wrappersTruncated = true;
    if (detailed.status) binding.status = detailed.status;
    if (detailed.detail) binding.detail = detailed.detail;
    // section 15.12.1.3.4: a wrapper whose magic decoded but whose body ran out is the
    // signature of a partial copy, whatever the hash later says.
    if (carrier?.wrappers.some(isCutWrapper)) binding.fragment = true;

    if (detailed.status === C2PA_TEXT_STATUS.tooLarge) {
      // "We declined to look", NOT "we looked and it is broken". The size refusal
      // used to land in the invalid-credential arm, so a 17 MiB saved web page
      // with no C2PA anywhere in it - or any long text that merely QUOTED the
      // armour delimiter - was reported as a credential that failed to read. A
      // verdict manufactured from file size alone is the same false positive the
      // section A.9.5 branch below refuses to make, and plan 105 section 2 turns on not making
      // it. The status stays on report.textBinding, so nothing is hidden.
      report.reason = detailed.detail
        ? `no Content Credentials read - ${detailed.detail}`
        : 'no Content Credentials read - this asset is past the size limit for on-device text inspection';
      return report;
    }
    if (detailed.store) {
      // NB a `manifest.text.multipleWrappers` status here is a NOTICE, not yet a
      // failure: section 15.12.1.3.1 only rejects when more than one wrapper matches
      // the ASSERTION's exclusions, which the hard-binding step below decides.
      // It stays visible on report.textBinding.status either way.
      //
      // section A.8.4.1 gives wrapper SELECTION to the exclusions, so when there is more
      // than one to choose from, ask them (see selectWrapperByExclusions) before
      // this store - the first one in document order - becomes the manifest whose
      // claim the whole report describes.
      const picked = carrier ? selectWrapperByExclusions(carrier) : null;
      if (picked) {
        binding.selectedWrapper = carrier!.wrappers.indexOf(picked) + 1;
        extracted = { manifest: picked.store! };
      } else {
        extracted = { manifest: detailed.store };
      }
    } else if (detailed.externalUrl && externalManifest?.length) {
      // The caller already read `manifestUrl` off a previous report and fetched
      // it under its own policy (the web shell only does this same-origin, on an
      // explicit click). The engine's no-network rule is untouched - these bytes
      // arrived as an argument. Flagged on the binding so no surface can print
      // "the credential inside this document" about a credential that was not.
      binding.externalManifestUsed = true;
      extracted = { manifest: externalManifest };
    } else if (detailed.externalUrl) {
      // section A.7.1.2 / section A.9.3: the credential exists, it just is not in these bytes.
      // Resolution is explicitly OPTIONAL for a validator (section A.7.1.4), and this
      // engine never performs network I/O, so the honest answer is the spec's
      // own "remote manifest not obtained" - never "no Content Credentials".
      report.found = true;
      report.state = 'invalid';
      report.reason = `this ${bindingKind === 'html' ? 'document' : 'file'} references an external C2PA manifest at ${detailed.externalUrl} - the engine never fetches, so it could not be checked against these bytes`;
      fail(C2PA_CHECK.manifestInaccessible, `references an external manifest (${detailed.externalUrl}); fetch it and verify it against these bytes`);
      return report;
    } else if (detailed.status === C2PA_TEXT_STATUS.structuredTextNoManifest) {
      // section A.9.5 asks for a manifest.structuredText.noManifest FAILURE here.
      // DELIBERATE DEVIATION, and the reason is that this file sniffed as 'code'
      // purely because one armour delimiter appeared in it: prose that quotes
      // `-----BEGIN C2PA MANIFEST-----` (this repo's own plans do) is
      // indistinguishable from a damaged block, and calling it a broken
      // credential would be the louder lie. The status is still reported on
      // report.textBinding, so nothing is hidden - only the verdict is withheld.
      report.reason = 'no Content Credentials found - the section A.9 manifest block delimiters are not both present';
      return report;
    } else if (detailed.status) {
      report.found = true;
      report.state = 'invalid';
      report.reason = detailed.detail || `C2PA text binding unusable: ${detailed.status}`;
      fail(textStatusCheck(bindingKind, detailed.status), report.reason);
      return report;
    } else {
      report.reason = 'no Content Credentials found';
      return report;
    }
  } else {
    try {
      extracted = EXTRACTORS[format]!(bytes);
    } catch (err) {
      const msg = (err as Error).message;
      report.reason = msg;
      if (/not a PDF/.test(msg)) return report;
      report.found = true;
      report.state = 'invalid';
      fail(C2PA_CHECK.credentialUnreadable,msg);
      return report;
    }
    if (!extracted) {
      report.reason = 'no Content Credentials found';
      return report;
    }
  }
  report.found = true;

  let parts: C2paStoreParts;
  let claim: Map<unknown, unknown>;
  try {
    parts = parseC2paStore(extracted.manifest);
    const decodedClaim = decodeCbor(parts.claimBytes);
    if (!(decodedClaim instanceof Map)) throw new Error('claim is not a CBOR map');
    claim = decodedClaim;
  } catch (err) {
    report.state = 'invalid';
    report.reason = `credential is malformed: ${(err as Error).message}`;
    fail(C2PA_CHECK.credentialUnreadable,(err as Error).message);
    return report;
  }

  // v1 uses the 'c2pa.actions' assertion; v2 uses 'c2pa.actions.v2'. The action
  // maps share the same shape for the fields read here (action/when), except
  // softwareAgent is a bare string in v1 and a generator-info map in v2.
  const actionsAssertion = parts.assertions.find((a) => a.label === 'c2pa.actions' || a.label === 'c2pa.actions.v2');
  let actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; parameters?: unknown }> = [];
  try {
    const decoded = actionsAssertion && (decodeCbor(actionsAssertion.content) as Map<unknown, unknown>).get('actions');
    if (Array.isArray(decoded)) {
      actions = decoded.map((a) => {
        const sa = a.get?.('softwareAgent');
        return {
          action: a.get?.('action'),
          when: a.get?.('when'),
          // v2 softwareAgent is a { name, version } map; surface its name.
          softwareAgent: sa instanceof Map ? sa.get('name') : sa,
          // IPTC provenance kind of this step (digitalCapture / digitalCreation /
          // trainedAlgorithmicMedia …) - the signal behind the AI-generated flag.
          digitalSourceType: a.get?.('digitalSourceType'),
          description: a.get?.('description'),
          // Raw CBOR parameters (a Map from our decoder) - the machine-readable
          // context a writer recorded on the step (e.g. a TTS clip's script).
          parameters: a.get?.('parameters'),
        };
      });
    }
  } catch { /* absent/opaque actions are a display nicety, not a check */ }

  const mapToObj = (m: unknown): Record<string, string | number | boolean> | null => {
    if (!(m instanceof Map)) return null;
    const o: Record<string, string | number | boolean> = {};
    for (const [k, v] of m) if (typeof k === 'string' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) o[k] = v;
    return o;
  };
  // claim_generator_info is an array of generator maps in v1 (optional, read
  // its first entry) and a single generator map in v2 (required - the
  // free-text claim_generator string is gone in v2, so this is the sole
  // generator identity).
  const genInfo = claim.get('claim_generator_info');
  report.claim = {
    title: claim.get('dc:title'),
    format: claim.get('dc:format'),
    claimGenerator: claim.get('claim_generator'),
    generatorInfo: mapToObj(Array.isArray(genInfo) ? genInfo[0] : genInfo),
    instanceId: claim.get('instanceID'),
    manifestLabel: parts.manifestLabel,
    actions,
  };
  // C2PA 2.4 moved specVersion out of the claim and into claim_generator_info;
  // the claim-level field is deprecated but "a validator should read it", so
  // both are tolerated, generator-info first. Purely informational per
  // section 10.2.3.1 - nothing below branches on the value.
  const declaredSpec = report.claim.generatorInfo?.specVersion ?? claim.get('specVersion');
  if (typeof declaredSpec === 'string' && declaredSpec.trim()) report.specVersion = declaredSpec.trim();

  // section 18.28 c2pa.ai-disclosure - read for EVERY format, not just the text
  // bindings. Integrity of the assertion is covered by the hashed-URI check like
  // any other; a malformed one is simply absent here.
  //
  // ALL of them, not the first: section 18.28's stated purpose is "full disclosure of
  // the AI MODELS used" (plural), and section 1558 labels repeats `label__1`, `label__2`
  // - so a two-model pipeline that disclosed both had its second disclosure
  // dropped silently. section 1560 also makes a version part of the label, so a future
  // `c2pa.ai-disclosure.v2` has to match, or it reads as no disclosure at all.
  const AI_DISCLOSURE_LABEL = /^c2pa\.ai-disclosure(\.v\d+)?(__\d+)?$/;
  const disclosures = parts.assertions
    .filter((a) => AI_DISCLOSURE_LABEL.test(a.label))
    .map((a) => readAiDisclosure(a.content))
    .filter((d): d is C2paAiDisclosure => !!d);
  if (disclosures.length) {
    report.aiDisclosure = disclosures[0];
    // The extra ones only appear when there ARE extra ones, so the common
    // single-model report keeps exactly the shape its consumers already read.
    if (disclosures.length > 1) report.aiDisclosures = disclosures;
  }

  // The whole provenance chain across every manifest (the active manifest's own
  // `actions` above is just its last link) - used for the edit-history timeline
  // and to flag AI origin wherever in the chain it was declared.
  const chain = collectActionChain(extracted.manifest);
  if (chain.length) report.history = chain;

  // AI-generated provenance: scan the chain's digitalSourceType for the IPTC
  // "trained algorithmic media" codes. A single full-AI step wins over any number
  // of composite ones (a wholly-generated origin is the louder truth).
  for (const s of chain) {
    const kind = aiKind(s.digitalSourceType);
    if (kind && (!report.aiGenerated || kind === 'generated')) {
      report.aiGenerated = { kind, sourceType: s.digitalSourceType as string };
      if (kind === 'generated') break;
    }
  }

  // Export context recorded by the writer (tool, surface, browser engine, OS…)
  // - a custom assertion; its integrity is covered by the hashed-URI check.
  const exportAssertion = parts.assertions.find((a) => a.label === LOLLY_EXPORT_ASSERTION);
  if (exportAssertion) {
    try {
      const decoded = decodeCbor(exportAssertion.content);
      const env = mapToObj(decoded) as (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
      if (env) {
        // The scalar keys come through mapToObj; the nested `inputs` map (the
        // scalar-input digest) is a CBOR Map it drops, so lift it separately -
        // string→string only, so a crafted assertion can't inject other shapes.
        const rawInputs = decoded instanceof Map ? decoded.get('inputs') : undefined;
        if (rawInputs instanceof Map) {
          const inputs: Record<string, string> = {};
          for (const [k, v] of rawInputs) if (typeof k === 'string' && typeof v === 'string') inputs[k] = v;
          if (Object.keys(inputs).length) env.inputs = inputs;
        }
        report.environment = env;
      }
    } catch { /* display nicety only */ }
  }

  // Authorship. v2 records it in the CAWG metadata assertion (`cawg.metadata`,
  // JSON-LD Dublin Core dc:creator - the strict `c2pa.metadata` assertion
  // forbids creator fields); v1 used the schema.org CreativeWork assertion.
  // Prefer the metadata assertion, fall back to CreativeWork. Integrity of both
  // is covered by the hashed-URI check above/below.
  const metaAssertion = parts.assertions.find((a) => a.label === 'cawg.metadata' || a.label === 'c2pa.metadata');
  if (metaAssertion) {
    try {
      const meta = JSON.parse(td.decode(metaAssertion.content));
      const creator = meta?.['dc:creator'];
      const name = Array.isArray(creator) ? creator[0] : creator;
      // Lolly writes the licensing contact into the creator entry npm-style -
      // `Name <email> (site)` - so it survives in a single Dublin Core term that
      // any external viewer displays verbatim; unpick it here so /verify (and the
      // terminal report) can show the contact as its own fact.
      if (name) report.author = parseCreatorEntry(String(name));
      const rights = meta?.['dc:rights'];
      if (typeof rights === 'string' && rights.trim()) report.rights = rights.trim();
    } catch { /* display nicety only */ }
  }
  const creativeWork = parts.assertions.find((a) => a.label === 'stds.schema-org.CreativeWork');
  if (creativeWork && (!report.author || !report.rights)) {
    try {
      const work = JSON.parse(td.decode(creativeWork.content));
      const person = work?.author?.[0];
      if (!report.author && person?.name) {
        report.author = {
          name: String(person.name),
          ...(person.email ? { email: String(person.email) } : {}),
          ...(person.url ? { url: String(person.url) } : {}),
        };
      }
      // Third-party v1 writers put rights on the CreativeWork itself
      // (schema.org copyrightNotice and/or license - either may be present).
      if (!report.rights) {
        const notice = [work?.copyrightNotice, work?.license].filter((v: unknown) => typeof v === 'string' && v.trim()).join(' · ');
        if (notice) report.rights = notice;
      }
    } catch { /* display nicety only */ }
  }

  // 1. Hashed-URI references: each assertion the claim lists must hash to the
  //    superbox payload actually present in the store. A crafted claim can put
  //    ANYTHING in this array (non-map entries, refs without a hash) - each
  //    malformation is a failed check, never an escaped exception.
  // v1 lists every assertion reference in one `assertions` array. v2 splits
  // them into `created_assertions` (required - the hard binding + actions.v2,
  // authored by this claim generator) and optional `gathered_assertions`
  // (carried in from ingredients). Both are hashed-URI references, verified
  // identically, so the loop treats them as one flat list. Wiring BOTH here is
  // required: a v2 claim whose references were never read would leave every
  // assertion unverified behind only the hard binding.
  const refs = parts.claimVersion === 2
    ? [
        ...(Array.isArray(claim.get('created_assertions')) ? (claim.get('created_assertions') as unknown[]) : []),
        ...(Array.isArray(claim.get('gathered_assertions')) ? (claim.get('gathered_assertions') as unknown[]) : []),
      ]
    : claim.get('assertions');
  for (const ref of Array.isArray(refs) ? refs : []) {
    const url = ref instanceof Map ? ref.get('url') : null;
    const hash = ref instanceof Map ? ref.get('hash') : null;
    if (typeof url !== 'string' || !(hash instanceof Uint8Array)) {
      fail(C2PA_CHECK.assertionHashedUriMismatch,'malformed assertion reference in the claim');
      continue;
    }
    const label = url.startsWith(HASHED_URI_PREFIX) ? url.slice(HASHED_URI_PREFIX.length) : null;
    const assertion = label && parts.assertions.find((a) => a.label === label);
    if (!assertion) {
      fail(C2PA_CHECK.assertionMissing,`claim references ${url} but the store has no such assertion`);
      continue;
    }
    if (hexOf(await sha256(assertion.payload)) === hexOf(hash)) {
      pass(C2PA_CHECK.assertionHashedUriMatch,`hashed uri matched: ${url}`);
    } else {
      fail(C2PA_CHECK.assertionHashedUriMismatch,`hash does not match assertion data: ${url}`);
    }
  }

  // 2. COSE claim signature (detached payload = the claim bytes).
  let signerAlg: string | null = null;
  // Carried out of this block to the identity verdict below: the trust decision
  // must see the claim-signature result and the anchor match together, AFTER
  // the hard binding has been checked. A leaf certificate is PUBLIC (it rides
  // in every credentialed file the signer publishes), so chaining it to the
  // pinned root proves only that the CA once bound that key to that email - NOT
  // that this key signed THIS content. Only `claimSigValid === true` proves the
  // latter, so trust/identity are gated on it, never on the chain alone.
  let claimSigValid: boolean | null = null;   // true only if the COSE signature verified
  let anchorMatch: ParsedCertificate | null = null;     // the pinned anchor the chain reached, or null
  let leafInsideValidity = false;
  let leafSanEmail: string | null = null;
  try {
    const cose = decodeCbor(parts.signatureBytes) as { tag?: unknown; value?: unknown } | null;
    if (cose?.tag !== 18) throw new Error('claim signature is not COSE_Sign1_Tagged');
    const [protBytes, unprotected, , sigRaw] = cose!.value as unknown[];
    const prot = decodeCbor(protBytes as Uint8Array) as Map<unknown, unknown>;
    const alg = COSE_ALGS[String(prot.get(1))];
    // Header 33 is the registered x5chain label; early C2PA files used the
    // text label "x5chain", in either the protected or unprotected bucket.
    const unprot = unprotected as Map<unknown, unknown> | null | undefined;
    const chain = prot.get(33) ?? prot.get('x5chain') ?? unprot?.get(33) ?? unprot?.get('x5chain');
    const chainDers: unknown[] = Array.isArray(chain) ? chain : [chain];
    const certDer = chainDers[0];
    if (!(certDer instanceof Uint8Array)) throw new Error('no x5chain certificate in signature headers');

    const cert = parseCertificate(certDer);
    signerAlg = alg?.name || `COSE alg ${String(prot.get(1))}`;
    report.signer = {
      commonName: cert.subject.commonName,
      organization: cert.subject.organization,
      notBefore: cert.notBefore.toISOString(),
      notAfter: cert.notAfter.toISOString(),
      selfSigned: cert.selfSigned,
      alg: signerAlg,
    };

    if (!alg) {
      fail(C2PA_CHECK.claimSignatureMismatch,`unsupported signing algorithm (${signerAlg}) - cannot verify on-device`);
    } else {
      const sigStructure = encodeCbor(['Signature1', protBytes, new Uint8Array(0), parts.claimBytes]);
      try {
        claimSigValid = await verifyCoseSignature(alg, cert.spki, sigRaw as Uint8Array, sigStructure);
      } catch {
        fail(C2PA_CHECK.claimSignatureMismatch,`${alg.name} signatures cannot be verified on this device`);
        claimSigValid = null;
      }
      if (claimSigValid === true) pass(C2PA_CHECK.claimSignatureValidated,'claim signature valid');
      else if (claimSigValid === false) fail(C2PA_CHECK.claimSignatureMismatch,'claim signature is not valid');
    }

    const now = Date.now();
    leafInsideValidity = now >= cert.notBefore.getTime() && now <= cert.notAfter.getTime();
    if (leafInsideValidity) {
      pass(C2PA_CHECK.claimSignatureInsideValidity,'signing certificate within its validity window');
    } else {
      fail(C2PA_CHECK.signingCredentialExpired,'signing certificate expired (or not yet valid)');
    }

    // Does the chain reach a caller-pinned anchor? Record it - but the identity
    // and trusted verdict are NOT decided here: they also require the claim
    // signature to have verified and the hard binding (checked below) to match.
    // See the identity verdict after section 3.
    leafSanEmail = cert.sanEmails[0] ?? null;
    if (Array.isArray(trustAnchors) && trustAnchors.length) {
      anchorMatch = await chainsToAnchor(cert, chainDers, trustAnchors);
    }
  } catch (err) {
    fail(C2PA_CHECK.claimSignatureMismatch,`claim signature could not be verified: ${(err as Error).message}`);
  }

  // 3. Hard binding: sha256 of the file with the exclusion ranges omitted -
  //    or, for BMFF assets, the box-walking c2pa.hash.bmff.v2/v3 binding.
  const hashData = parts.assertions.find((a) => a.label === 'c2pa.hash.data');
  const bmffHash = parts.assertions.find((a) => /^c2pa\.hash\.bmff(\.v\d+)?$/.test(a.label));
  if (!hashData && bmffHash) {
    try {
      const hd = decodeCbor(bmffHash.content) as Map<unknown, unknown>;
      if ((hd.get('alg') || 'sha256') !== 'sha256') throw new Error(`unsupported hash alg ${String(hd.get('alg'))}`);
      if (hd.get('merkle')) throw new Error('fragmented (Merkle) BMFF bindings are not supported on this device');
      // v1 hashes the surviving boxes' bytes; v2/v3 prefix each with its
      // u64-BE file offset (verified against c2patool output). A future v4+
      // may hash differently - reporting honest "unchecked" beats a false
      // tamper accusation.
      const version = bmffHash.label === 'c2pa.hash.bmff' ? 1 : Number(bmffHash.label.slice('c2pa.hash.bmff.v'.length));
      if (version > 3) throw new Error(`BMFF hash version v${version} is newer than this device's verifier`);
      const exclusions = ((hd.get('exclusions') || []) as Array<Map<unknown, unknown>>).map((e) => ({
        xpath: e.get('xpath') as unknown,
        data: e.get('data') as unknown,
        length: e.get('length') as unknown,
        subset: e.get('subset') as unknown,
        version: e.get('version') as unknown,
        flags: e.get('flags') as unknown,
      }));
      for (const e of exclusions) {
        if (typeof e.xpath !== 'string' || !/^\/[a-zA-Z0-9 ]{4}$/.test(e.xpath) || e.subset != null || e.version != null || e.flags != null) {
          throw new Error('this BMFF exclusion form is not supported on this device');
        }
      }
      const excluded = (b: BmffBox): boolean => exclusions.some((e) =>
        e.xpath === `/${b.type}`
        && (e.length == null || e.length === b.size)
        && ((e.data || []) as Array<Map<unknown, unknown>>).every((d) => {
          const off = b.off + (d.get('offset') as number);
          const value = d.get('value');
          return value instanceof Uint8Array && off + value.length <= b.off + b.size
            && value.every((v, i) => bytes[off + i] === v);
        }));
      const spans: Uint8Array[] = [];
      for (const b of bmffTopBoxes(bytes)) {
        if (excluded(b)) continue;
        if (version >= 2) {
          const marker = new Uint8Array(8);
          for (let i = 7, n = b.off; i >= 0; i--) { marker[i] = n % 256; n = Math.floor(n / 256); }
          spans.push(marker);
        }
        spans.push(bytes.subarray(b.off, b.off + b.size));
      }
      if (hexOf(await sha256(concatBytes(spans))) === hexOf(hd.get('hash') as Uint8Array)) {
        pass(C2PA_CHECK.assertionBmffHashMatch,'BMFF hash valid');
      } else {
        fail(C2PA_CHECK.assertionBmffHashMismatch,'the file bytes do not match the credential - the file changed after signing');
      }
    } catch (err) {
      fail(C2PA_CHECK.assertionBmffHashMismatch,`hard binding could not be checked: ${(err as Error).message}`);
    }
  } else if (!hashData) {
    fail(C2PA_CHECK.assertionDataHashMismatch,'no hard binding (c2pa.hash.data or c2pa.hash.bmff) in the manifest');
  } else if (carrier && report.textBinding?.kind === 'text') {
    // ── section 15.12.1.3.1: validating a text data hash ─────────────────────────────
    //
    // The ONE place in this file where the hard binding does not hash the bytes
    // that were handed in. section A.8.7.3 is explicit: "the exclusions field … uses
    // byte offsets in the NFC-normalized UTF-8 encoded text … perform
    // normalization before calculating offsets". So the asset is decoded,
    // NFC-normalized ONCE by the extractor (carrier.nfc), and every offset -
    // both the wrappers' and the assertion's - is read in that encoding.
    //
    // section A.8.6.1 and section 15.12.1.3.1 then give the removal and the re-normalization
    // in opposite orders ("the NFC-normalized text AFTER removing the excluded
    // bytes" vs "remove → normalize → encode → hash"). Only one reading is
    // self-consistent with offsets living in NFC space, and this implements
    // BOTH literally: normalize first (so the offsets mean something), remove,
    // then normalize the remainder again. That second pass is a no-op for every
    // conformant asset - section A.8.4.1 puts the wrapper in a single contiguous block
    // at the END of the visible text - and only bites when a splice puts a base
    // character next to a following combining mark, which the spec's own step
    // list says to fix. Pinned by test either way.
    const binding = report.textBinding;
    try {
      const hd = decodeCbor(hashData.content) as Map<unknown, unknown>;
      if ((hd.get('alg') || 'sha256') !== 'sha256') throw new Error(`unsupported hash alg ${String(hd.get('alg'))}`);
      const nfcBytes = te.encode(carrier.nfc);
      const exclusions = readExclusions(hd);
      let at = 0;
      for (const e of exclusions) {
        if (!(Number.isInteger(e.start) && Number.isInteger(e.length)) || e.start < at || e.length < 0) {
          throw new Error('exclusion ranges are out of order or out of range');
        }
        // section 15.12.1.3.4: an exclusion that runs past the end of the text we were
        // given means the signed original was LONGER than this copy - the
        // machine-checkable half of "this looks like a fragment".
        //
        // Gated on a wrapper actually being here: a self-signed assertion can
        // declare `start: 1e15` on a text carrying no wrapper at all, and the
        // verdict is `invalid` either way - but "looks like a fragment of a
        // larger signed text" would then be a sentence the ATTACKER wrote, not
        // one the evidence supports.
        if (e.start + e.length > nfcBytes.length) {
          if (carrier.wrappers.length) binding.fragment = true;
          throw new Error('an exclusion range runs past the end of the text - the signed text was longer than this copy');
        }
        at = e.start + e.length;
      }
      // Step 2: select the wrapper(s) the exclusions name. section A.8 never settles
      // whether an exclusion starts at the U+FEFF prefix or at the first
      // variation selector (section A.8.6.1 says "the location of the wrapper";
      // section A.8.4.1 calls U+FEFF a prefix TO the wrapper; section A.8.2.2's struct starts
      // at the magic), so BOTH conventions are accepted and which one matched is
      // reported. Neither is more permissive than the other: each removes only
      // wrapper bytes, and the producer had to hash whichever it chose.
      const matched: C2paTextWrapper[] = [];
      for (const e of exclusions) {
        const w = carrier.wrappers.find((c) => e.start === c.start && e.length === c.end - c.start)
          ?? carrier.wrappers.find((c) => e.start === c.selectorStart && e.length === c.end - c.selectorStart);
        if (!w) {
          // section A.8.7.3: "validate that excluded regions correspond exactly to
          // C2PATextManifestWrapper boundaries". An exclusion that does not is
          // how a forged assertion would carve unbound content out of a signed
          // text, so it is refused rather than honoured.
          //
          // …unless the wrapper walk hit its cap, in which case the range may
          // correspond perfectly to a wrapper we never got to. Same refusal
          // (nothing here can be checked), but the sentence stays true.
          throw new Error(carrier.truncated
            ? `an exclusion range matches none of the first ${carrier.wrappers.length} C2PATextManifestWrappers, and this text carries more than the reader will walk`
            : 'an exclusion range does not correspond to a C2PATextManifestWrapper');
        }
        if (!matched.includes(w)) matched.push(w);
        binding.exclusionsFrom = e.start === w.start ? 'wrapper' : 'selectors';
      }
      binding.matchedWrappers = matched.length;
      // section 15.12.1.3.1 step 3/4 - the two named rejections.
      if (!matched.length) throw new Error('the data hash declares no exclusion matching any C2PATextManifestWrapper');
      if (matched.length > 1) {
        fail(C2PA_CHECK.manifestTextMultipleWrappers, `${matched.length} C2PATextManifestWrappers match the assertion's exclusions; section 15.12.1.3.1 allows one`);
      } else {
        const spans: Uint8Array[] = [];
        let cut = 0;
        for (const e of exclusions) {
          spans.push(nfcBytes.subarray(cut, e.start));
          cut = e.start + e.length;
        }
        spans.push(nfcBytes.subarray(cut));
        // Steps 6–7. Removing a whole wrapper always cuts on code-point
        // boundaries (its range came from a decode of this same string), so the
        // remainder is valid UTF-8 and the round-trip is lossless.
        const remaining = te.encode(tdText.decode(concatBytes(spans)).normalize('NFC'));
        if (hexOf(await sha256(remaining)) === hexOf(hd.get('hash') as Uint8Array)) {
          pass(C2PA_CHECK.assertionDataHashMatch,'data hash valid (NFC-normalized text, section 15.12.1.3.1)');
        } else {
          fail(C2PA_CHECK.assertionDataHashMismatch,'the text does not match the credential - it changed after signing');
        }
      }
    } catch (err) {
      // section 15.12.1.3.1 steps 3 and section A.8.7.3: a text data hash whose exclusions do
      // not name a wrapper is MALFORMED, a distinct thing from "the bytes
      // changed" - and the distinction is the whole point for a pasted fragment.
      fail(C2PA_CHECK.assertionDataHashMalformed,`the text hard binding could not be checked: ${(err as Error).message}`);
    }
  } else {
    try {
      const hd = decodeCbor(hashData.content) as Map<unknown, unknown>;
      if ((hd.get('alg') || 'sha256') !== 'sha256') throw new Error(`unsupported hash alg ${String(hd.get('alg'))}`);
      const exclusions = ((hd.get('exclusions') || []) as Array<Map<unknown, unknown>>)
        .map((e) => ({ start: e.get('start') as number, length: e.get('length') as number }))
        .sort((a, b) => a.start - b.start);
      const spans: Uint8Array[] = [];
      let at = 0;
      for (const e of exclusions) {
        if (!(Number.isInteger(e.start) && Number.isInteger(e.length)) || e.start < at || e.start + e.length > pdfBytes.length) {
          // section 15.12.1: out-of-order, overlapping or negative ranges are
          // assertion.dataHash.MALFORMED, which is a different fact from "the
          // bytes changed". The binary containers keep reporting `mismatch` (that
          // is pre-existing behaviour on a path this wave must not move), but the
          // two new text formats are new arrivals here, so they get the code the
          // spec names.
          throw Object.assign(new Error('exclusion ranges are out of order or out of range'), { malformed: true });
        }
        spans.push(pdfBytes.subarray(at, e.start));
        at = e.start + e.length;
      }
      spans.push(pdfBytes.subarray(at));
      // section A.7.1.3 / section A.9.4: an HTML document's or a structured-text file's data
      // hash "shall include a SINGLE exclusion range covering the entire
      // element/block". The whole point of a raw-byte binding is that the bytes
      // outside the credential are bound; an exclusion that covers anything else
      // is a hole in exactly that guarantee, so it is reported rather than
      // honoured silently. Only checked for the two 2.4 byte-range text
      // bindings, where the spec pins the range exactly; binary containers keep
      // their existing behaviour untouched.
      const carve = htmlCodeExclusionConformance(report.textBinding, advisoryExclusions, advisoryAlternates, exclusions);
      if (carve) {
        report.textBinding!.exclusionsConform = carve.kind;
        // Only the 'other' shape is a hole in the binding. A narrower exclusion
        // leaves the carrier INSIDE the hash - non-conforming, but more strongly
        // bound - and failing it would be accusing a file whose bytes we can
        // show are intact.
        if (carve.kind === 'other') fail(C2PA_CHECK.assertionDataHashAdditionalExclusions, carve.message);
      }
      // The hash RUNS either way: "non-conforming but intact" and
      // "non-conforming and changed" are different answers, and the reader
      // deserves the one that is true of their file.
      const qualifier = carve ? ` (the declared exclusion does not match the carrier: ${carve.message})` : '';
      if (hexOf(await sha256(concatBytes(spans))) === hexOf(hd.get('hash') as Uint8Array)) {
        pass(C2PA_CHECK.assertionDataHashMatch, `data hash valid${qualifier}`);
      } else {
        fail(C2PA_CHECK.assertionDataHashMismatch, `the file bytes do not match the credential - the file changed after signing${qualifier}`);
      }
    } catch (err) {
      const malformed = !!(err as { malformed?: boolean }).malformed && !!report.textBinding;
      fail(malformed ? C2PA_CHECK.assertionDataHashMalformed : C2PA_CHECK.assertionDataHashMismatch,
        `hard binding could not be checked: ${(err as Error).message}`);
    }
  }

  // Verified identity is granted ONLY when all three hold together:
  //   (a) the leaf chains to a caller-pinned anchor (anchorMatch),
  //   (b) the COSE claim signature verified under that leaf's key
  //       (claimSigValid === true) - so this identity signed THIS claim, not
  //       merely that the CA once issued the (public) leaf, and
  //   (c) the credential is otherwise intact: every check passed except, at
  //       most, the cert's own validity window. An expired-but-authentic
  //       signature still proves WHO (identity surfaced) though not WHEN
  //       (trusted stays false); any OTHER failure - a bad claim signature, a
  //       hard-binding/hash mismatch (tampered bytes), a missing assertion -
  //       means this is not this identity's signed content, so no identity and
  //       no trust, even when the file carries a victim's public leaf cert.
  // This closes the public-leaf replay: an attacker can copy a victim's leaf
  // but cannot produce a claim signature that verifies under the victim's
  // (non-extractable) key, so claimSigValid is false and nothing is granted.
  if (anchorMatch && claimSigValid === true) {
    const otherFailure = checks.some((c) => !c.ok && c.code !== C2PA_CHECK.signingCredentialExpired);
    if (!otherFailure) {
      report.signer!.identity = {
        email: leafSanEmail,
        issuer: anchorMatch.subject.commonName || anchorMatch.subject.organization,
      };
      report.trusted = leafInsideValidity;
    }
  }

  // Identity verdict row. Default: there is no trust list and on-device
  // credentials are ephemeral by design - reported with the standard code,
  // excluded from the state verdict. A chain verified to a caller-pinned
  // anchor (identity is only ever set on that path) upgrades the row.
  if (report.signer?.identity) {
    const who = report.signer.identity.email || report.signer.commonName;
    pass(C2PA_CHECK.signingCredentialTrusted,report.trusted
      ? `signing certificate chains to a pinned CA root - verified identity: ${who}`
      : `signing certificate chains to a pinned CA root - verified identity: ${who} (certificate has since expired; signing time cannot be proven - no timestamp authority yet)`);
  } else {
    // TWO DIFFERENT FACTS, and conflating them was fine only while every unanchored
    // file really was self-signed. An enrolled identity (the CLI's --sign-key, the
    // browser's CA enrolment) produces a CA-ISSUED certificate that simply does not
    // chain to any anchor THIS verifier pinned - telling that reader "an ephemeral
    // on-device key" is false, and it points them at the wrong fix. Read the leaf.
    fail(C2PA_CHECK.signingCredentialUntrusted, untrustedReason(report.signer));
  }

  report.state = checks.every((c) => c.ok || c.code === C2PA_CHECK.signingCredentialUntrusted) ? 'valid' : 'invalid';
  // "Genuinely made with Lolly" = the credential is intact (signature + hashes
  // + binding all verify), it records a Lolly CREATION (a c2pa.created action -
  // not merely a delivery), AND it names Lolly as the generator. Requiring the
  // created action keeps the claim honest: a delivered/distributed asset can
  // name Lolly without ever reading as authored by it.
  const acts = report.claim!.actions || [];
  const created = acts.some((a) => a.action === 'c2pa.created');
  const names = [report.claim!.claimGenerator, report.claim!.generatorInfo?.name].filter(Boolean).join(' ');
  const claimsLolly = created && /\blolly\b/i.test(names);
  report.madeWithLolly = report.state === 'valid' && claimsLolly;
  // Softer verdict for the common re-save case: every check passed EXCEPT the
  // hard binding (the file's bytes, not the manifest's content). The claim
  // signature and every hashed-URI-bound assertion - including the actions and
  // export-context digest this report shows as edit history / "made from" -
  // are verified, so that CONTENT is trustworthy; we just can't vouch for the
  // bytes as they stand now. Never true when madeWithLolly already is.
  const onlyBindingUnverified = checks.every((c) => c.ok
    || c.code === C2PA_CHECK.signingCredentialUntrusted
    || c.code === C2PA_CHECK.assertionDataHashMismatch
    || c.code === C2PA_CHECK.assertionBmffHashMismatch);
  report.likelyMadeWithLolly = !report.madeWithLolly && onlyBindingUnverified && claimsLolly;
  // "Parts made with Lolly": an INTACT credential whose active manifest isn't a
  // Lolly creation, but whose preserved chain records Lolly steps (softwareAgent
  // or recording manifest's generator) - a Lolly export that another tool later
  // opened/edited and re-signed. Requires state 'valid' so the chain content
  // shown was actually captured by a verified manifest, not loose bytes.
  report.partsMadeWithLolly = report.state === 'valid' && !report.madeWithLolly && !report.likelyMadeWithLolly
    && (report.history ?? []).some((s) => /\blolly\b/i.test(
      `${typeof s.softwareAgent === 'string' ? s.softwareAgent : ''} ${typeof s.generator === 'string' ? s.generator : ''}`));
  // "Delivered" = an intact credential over an EXISTING asset the signer
  // distributed but did not create (a c2pa.published action, no creation).
  // Drives the "Delivered by Lolly" / authentic-official-asset verdict.
  report.delivered = report.state === 'valid' && !created && acts.some((a) => a.action === 'c2pa.published');
  return report;
}

/** @deprecated alias - verifyC2pa sniffs PDFs (and every other container). */
export const verifyC2paPdf = verifyC2pa;
