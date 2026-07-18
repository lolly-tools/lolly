// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) verifier — pure, DOM-free.
 *
 * The read-side counterpart to c2pa.js: sniffs the container (PDF, PNG/APNG,
 * JPEG, GIF, SVG, TIFF, WebP, MP4/ISO-BMFF, WebM/Matroska), extracts the
 * embedded manifest the way c2pa-rs reads each format, walks the JUMBF store,
 * and re-checks everything a validator checks — the claim's hashed-URI
 * assertion references, the COSE claim signature (WebCrypto ES256/384/512
 * against the x5chain leaf), the certificate validity window, and the hard
 * binding: c2pa.hash.data (sha256 of the file with the exclusion ranges
 * OMITTED) or, for BMFF assets, c2pa.hash.bmff.v2/v3 (sha256 over the
 * surviving top-level boxes, each prefixed with its u64-BE file offset).
 * Entirely on-device: nothing is uploaded, mirroring the trust posture of the
 * writer (self-signed ephemeral keys — a credential is evidence of integrity,
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
 * That is an integrity statement, not an identity proof — any writer could
 * claim the name, which the view copy is honest about.
 *
 * `likelyMadeWithLolly` softens that verdict for the common re-save case: the
 * claim signature verified and every hashed-URI-bound assertion (the actions
 * we render as edit history, the export-context digest, …) matches what the
 * claim references — so the manifest's CONTENT is trustworthy — but the file's
 * own bytes no longer match the hard binding (it was re-encoded/re-uploaded/
 * re-saved through something that left the manifest alone but touched bytes
 * outside it). We can still honestly show what it was made from and its edit
 * history; we just can't vouch for the current bytes, hence "likely" rather
 * than the flat claim.
 *
 * Like c2pa.js / emf.js / eps.js this is a format authority: no DOM, no
 * Handlebars — fully node:test-able (globalThis.crypto only).
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
// ingredient prep) lives in c2pa-extract.ts — this file is the crypto core only:
// X.509/trust-chain walking and the actual COSE/hash verification. See that
// file's header for why the split. No runtime cycle: it imports only a type
// (C2paHistoryStep) back from here.
import {
  decodeCbor, parseC2paStore, sniffFormat, extractC2paFromPdf, EXTRACTORS,
  collectActionChain, aiKind, extractC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore,
  bmffTopBoxes,
} from './c2pa-extract.ts';
import type { C2paStoreParts, SniffFormat, C2paIngredientData, BmffBox } from './c2pa-extract.ts';
// Re-exported so every existing `from './c2pa-verify.ts'` import (index.ts, the
// test suite, the fuzz harness) keeps working unchanged — callers never need to
// know these moved to c2pa-extract.ts.
export {
  decodeCbor, parseC2paStore, sniffFormat, extractC2paFromPdf,
  extractC2paStore, prepareC2paIngredient, prepareC2paIngredientFromStore, aiKind,
};
export type { C2paIngredientData };

const td = new TextDecoder();
const te = new TextEncoder();
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

interface DName { commonName?: string; organization?: string; }

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
// read goes through der-read.ts's derTlv (bounds-checked BEFORE use — the GIF
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

interface ParsedCertificate {
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
type CertSigAlg =
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
    // Additive (1.11.0) — the chain-verification raw material. signatureRaw is
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
// Covers every scheme real C2PA CAs sign certificates with — ECDSA P-256/384/521
// (Google, camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft, DigiCert, SSL.com),
// RSA-PSS, and Ed25519 (Trufo). An unrecognised algorithm, a key that can't be
// imported for it, or any thrown error is a quiet no-match: a signer we cannot
// cryptographically verify stays honestly UNTRUSTED — never a false trust.
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
    // Ed25519 — the raw 64-byte signature verifies directly; not universal in
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
// verifications (minutes of pinned CPU) — verifyC2pa must never hang. So only
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
  // Ed25519 — not yet universal in WebCrypto; the caller reports a clear
  // "cannot verify on this device" when importKey/verify throws.
  const key = await subtle.importKey('spki', asBufferSource(spki), { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
}

const HASHED_URI_PREFIX = 'self#jumbf=c2pa.assertions/';

export interface C2paCheck { code: string; ok: boolean; explanation: string; }
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
  actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown }>;
}
// A file's provenance flagged as AI/ML-generated: `generated` = pixels produced
// wholly by a trained model, `composite` = a human work with AI-generated parts
// mixed in. `sourceType` is the raw IPTC DigitalSourceType URI it was read from.
export interface C2paAiOrigin {
  kind: 'generated' | 'composite';
  sourceType: string;
}
// One recorded provenance step — a C2PA action from any manifest in the chain.
// `generator` is the claim_generator(_info) of the manifest that RECORDED this
// step — the "who did it" the view renders as a software pill (softwareAgent, a
// per-action field many writers omit, takes precedence when present).
export interface C2paHistoryStep { action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; generator?: unknown; }
export interface C2paReport {
  found: boolean;
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  // The active manifest is NOT a (likely) Lolly creation, but the intact
  // credential's preserved provenance chain records Lolly steps — a Lolly
  // export later opened/edited/re-signed by another tool. Credits the Lolly
  // leg without claiming the whole file.
  partsMadeWithLolly: boolean;
  delivered: boolean;
  format: SniffFormat | null;
  checks: C2paCheck[];
  reason?: string;
  claim?: C2paClaim;
  // Scalar export-context keys (tool/surface/engine/os/date/dimensions…) plus an
  // optional nested `inputs` digest (id → short string) — the scalar inputs the
  // asset was rendered from, recorded by the writer's tools.lolly.export assertion.
  environment?: (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
  author?: { name: string; email?: string };
  signer?: C2paSigner;
  aiGenerated?: C2paAiOrigin;
  // The full provenance chain — every manifest's actions (parent/ingredient →
  // active), flattened in store order with adjacent duplicates collapsed.
  history?: C2paHistoryStep[];
}


/**
 * Verify a file's Content Credentials entirely on-device. Sniffs the
 * container (pdf/png/jpeg/gif/svg/tiff/webp) from magic bytes.
 *
 * opts.trustAnchors — Uint8Array[] of pinned root-certificate DER. When given,
 * the claim signature's full x5chain is checked against each anchor
 * (issuer-name bytes + ECDSA P-256/SHA-256 over the tbsCertificate, directly
 * or through one CA:TRUE intermediate). Zero-options behaviour is unchanged.
 *
 * → {
 *     found, state: 'valid'|'invalid'|'none', trusted, reason?,
 *     format:  sniffed container ('png', 'pdf', …) or null,
 *     madeWithLolly: boolean — credential INTACT and records Lolly as generator,
 *     likelyMadeWithLolly: boolean — the claim's own content is trustworthy
 *                (signature verified, every hashed-URI assertion matched) and
 *                records a Lolly creation, but the file's bytes no longer match
 *                the hard binding — a softer verdict for a re-saved/re-encoded
 *                Lolly export; false whenever madeWithLolly is already true,
 *     aiGenerated?: { kind: 'generated'|'composite', sourceType } — set when an
 *                action declares AI/ML-generated pixels (IPTC DigitalSourceType),
 *     history?: the full provenance chain — every manifest's actions flattened,
 *     claim?:  { title, format, claimGenerator, generatorInfo, instanceId, manifestLabel, actions },
 *     environment?: the `tools.lolly.export` assertion's export context,
 *     signer?: { commonName, organization, notBefore, notAfter, selfSigned, alg,
 *                identity? — { email, issuer } once the chain reaches a pinned anchor },
 *     checks:  [{ code, ok, explanation }],
 *   }
 *
 * `state` reflects integrity only: every check except the signingCredential
 * trust row must pass. `trusted` is the identity verdict: true only when the
 * chain reaches a pinned anchor AND the leaf is inside its validity window —
 * anchored-but-expired surfaces `signer.identity` but keeps trusted:false
 * (no timestamp authority yet, so the signing time cannot be proven). With no
 * anchors there is no trust list — a valid report means "this file is exactly
 * what the embedded credential signed", never "a known identity made this";
 * `madeWithLolly` is likewise an integrity-plus-claims statement, not an
 * identity proof.
 */
export async function verifyC2pa(bytes: Uint8Array, { trustAnchors }: { trustAnchors?: Uint8Array[] } = {}): Promise<C2paReport> {
  if (!(bytes instanceof Uint8Array)) throw new Error('verifyC2pa: bytes must be a Uint8Array');
  const checks: C2paCheck[] = [];
  const fail = (code: string, explanation: string): void => { checks.push({ code, ok: false, explanation }); };
  const pass = (code: string, explanation: string): void => { checks.push({ code, ok: true, explanation }); };
  const format = sniffFormat(bytes);
  const report: C2paReport = { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, delivered: false, format, checks };
  const pdfBytes = bytes; // the hard binding hashes the whole file, any container

  if (!format) {
    // C2PA-scoped, NOT a whole-file verdict: /verify (and MCP) inspect the file
    // for much more — the Lolly Imprint, SEAL, embedded metadata, appended data —
    // so this must never read as "unrecognised / can't inspect", only as "this
    // format doesn't carry Content Credentials".
    report.reason = 'no Content Credentials — these are embedded only in pdf, png, jpg, gif, svg, tiff, webp, mp4 and webm files';
    return report;
  }

  let extracted: { manifest: Uint8Array } | null;
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
  let actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown }> = [];
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
          // trainedAlgorithmicMedia …) — the signal behind the AI-generated flag.
          digitalSourceType: a.get?.('digitalSourceType'),
          description: a.get?.('description'),
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
  // its first entry) and a single generator map in v2 (required — the
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

  // The whole provenance chain across every manifest (the active manifest's own
  // `actions` above is just its last link) — used for the edit-history timeline
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
  // — a custom assertion; its integrity is covered by the hashed-URI check.
  const exportAssertion = parts.assertions.find((a) => a.label === LOLLY_EXPORT_ASSERTION);
  if (exportAssertion) {
    try {
      const decoded = decodeCbor(exportAssertion.content);
      const env = mapToObj(decoded) as (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
      if (env) {
        // The scalar keys come through mapToObj; the nested `inputs` map (the
        // scalar-input digest) is a CBOR Map it drops, so lift it separately —
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
  // JSON-LD Dublin Core dc:creator — the strict `c2pa.metadata` assertion
  // forbids creator fields); v1 used the schema.org CreativeWork assertion.
  // Prefer the metadata assertion, fall back to CreativeWork. Integrity of both
  // is covered by the hashed-URI check above/below.
  const metaAssertion = parts.assertions.find((a) => a.label === 'cawg.metadata' || a.label === 'c2pa.metadata');
  if (metaAssertion) {
    try {
      const creator = JSON.parse(td.decode(metaAssertion.content))?.['dc:creator'];
      const name = Array.isArray(creator) ? creator[0] : creator;
      if (name) report.author = { name: String(name) };
    } catch { /* display nicety only */ }
  }
  const creativeWork = parts.assertions.find((a) => a.label === 'stds.schema-org.CreativeWork');
  if (!report.author && creativeWork) {
    try {
      const person = JSON.parse(td.decode(creativeWork.content))?.author?.[0];
      if (person?.name) report.author = { name: String(person.name), ...(person.email ? { email: String(person.email) } : {}) };
    } catch { /* display nicety only */ }
  }

  // 1. Hashed-URI references: each assertion the claim lists must hash to the
  //    superbox payload actually present in the store. A crafted claim can put
  //    ANYTHING in this array (non-map entries, refs without a hash) — each
  //    malformation is a failed check, never an escaped exception.
  // v1 lists every assertion reference in one `assertions` array. v2 splits
  // them into `created_assertions` (required — the hard binding + actions.v2,
  // authored by this claim generator) and optional `gathered_assertions`
  // (carried in from ingredients). Both are hashed-URI references, verified
  // identically, so the loop treats them as one flat list. Wiring BOTH here is
  // load-bearing: a v2 claim whose references were never read would leave every
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
  // pinned root proves only that the CA once bound that key to that email — NOT
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
      fail(C2PA_CHECK.claimSignatureMismatch,`unsupported signing algorithm (${signerAlg}) — cannot verify on-device`);
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

    // Does the chain reach a caller-pinned anchor? Record it — but the identity
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

  // 3. Hard binding: sha256 of the file with the exclusion ranges omitted —
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
      // may hash differently — reporting honest "unchecked" beats a false
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
        fail(C2PA_CHECK.assertionBmffHashMismatch,'the file bytes do not match the credential — the file changed after signing');
      }
    } catch (err) {
      fail(C2PA_CHECK.assertionBmffHashMismatch,`hard binding could not be checked: ${(err as Error).message}`);
    }
  } else if (!hashData) {
    fail(C2PA_CHECK.assertionDataHashMismatch,'no hard binding (c2pa.hash.data or c2pa.hash.bmff) in the manifest');
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
          throw new Error('exclusion ranges are out of order or out of range');
        }
        spans.push(pdfBytes.subarray(at, e.start));
        at = e.start + e.length;
      }
      spans.push(pdfBytes.subarray(at));
      if (hexOf(await sha256(concatBytes(spans))) === hexOf(hd.get('hash') as Uint8Array)) {
        pass(C2PA_CHECK.assertionDataHashMatch,'data hash valid');
      } else {
        fail(C2PA_CHECK.assertionDataHashMismatch,'the file bytes do not match the credential — the file changed after signing');
      }
    } catch (err) {
      fail(C2PA_CHECK.assertionDataHashMismatch,`hard binding could not be checked: ${(err as Error).message}`);
    }
  }

  // Verified identity is granted ONLY when all three hold together:
  //   (a) the leaf chains to a caller-pinned anchor (anchorMatch),
  //   (b) the COSE claim signature verified under that leaf's key
  //       (claimSigValid === true) — so this identity signed THIS claim, not
  //       merely that the CA once issued the (public) leaf, and
  //   (c) the credential is otherwise intact: every check passed except, at
  //       most, the cert's own validity window. An expired-but-authentic
  //       signature still proves WHO (identity surfaced) though not WHEN
  //       (trusted stays false); any OTHER failure — a bad claim signature, a
  //       hard-binding/hash mismatch (tampered bytes), a missing assertion —
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
  // credentials are ephemeral by design — reported with the standard code,
  // excluded from the state verdict. A chain verified to a caller-pinned
  // anchor (identity is only ever set on that path) upgrades the row.
  if (report.signer?.identity) {
    const who = report.signer.identity.email || report.signer.commonName;
    pass(C2PA_CHECK.signingCredentialTrusted,report.trusted
      ? `signing certificate chains to a pinned CA root — verified identity: ${who}`
      : `signing certificate chains to a pinned CA root — verified identity: ${who} (certificate has since expired; signing time cannot be proven — no timestamp authority yet)`);
  } else {
    fail(C2PA_CHECK.signingCredentialUntrusted,'signing certificate untrusted — an ephemeral on-device key, not a CA-issued identity');
  }

  report.state = checks.every((c) => c.ok || c.code === C2PA_CHECK.signingCredentialUntrusted) ? 'valid' : 'invalid';
  // "Genuinely made with Lolly" = the credential is intact (signature + hashes
  // + binding all verify), it records a Lolly CREATION (a c2pa.created action —
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
  // signature and every hashed-URI-bound assertion — including the actions and
  // export-context digest this report shows as edit history / "made from" —
  // are verified, so that CONTENT is trustworthy; we just can't vouch for the
  // bytes as they stand now. Never true when madeWithLolly already is.
  const onlyBindingUnverified = checks.every((c) => c.ok
    || c.code === C2PA_CHECK.signingCredentialUntrusted
    || c.code === C2PA_CHECK.assertionDataHashMismatch
    || c.code === C2PA_CHECK.assertionBmffHashMismatch);
  report.likelyMadeWithLolly = !report.madeWithLolly && onlyBindingUnverified && claimsLolly;
  // "Parts made with Lolly": an INTACT credential whose active manifest isn't a
  // Lolly creation, but whose preserved chain records Lolly steps (softwareAgent
  // or recording manifest's generator) — a Lolly export that another tool later
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

/** @deprecated alias — verifyC2pa sniffs PDFs (and every other container). */
export const verifyC2paPdf = verifyC2pa;
