// SPDX-License-Identifier: MPL-2.0
/** Shared X.509 parsing and certificate signature verification. */
import { concatBytes, asBufferSource, bytesToHex as hexOf } from './bytes.ts';
import { derTlv, derChildren, ecdsaDerToRaw, EC_CURVES, type DerTlv } from './der-read.ts';
const td = new TextDecoder();
const subtle = globalThis.crypto.subtle;

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

function decodeTime(b: Uint8Array, tlv: DerTlv): Date {
  const s = td.decode(b.slice(tlv.contentStart, tlv.end));
  const four = tlv.tag === 0x18;
  const yy = four ? +s.slice(0, 4) : (+s.slice(0, 2) < 50 ? 2000 + +s.slice(0, 2) : 1900 + +s.slice(0, 2));
  const o = four ? 2 : 0;
  return new Date(Date.UTC(yy, +s.slice(2 + o, 4 + o) - 1, +s.slice(4 + o, 6 + o), +s.slice(6 + o, 8 + o), +s.slice(8 + o, 10 + o), +s.slice(10 + o, 12 + o)));
}

export interface DName { commonName?: string; organization?: string; }

function decodeName(cert: Uint8Array, nameTlv: DerTlv): DName {
  const out: DName = {};
  for (const rdn of derChildren(cert, nameTlv)) {
    for (const atv of derChildren(cert, rdn)) {
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

function decodeExtensions(cert: Uint8Array, kids: DerTlv[], shift: number): { sanEmails: string[]; isCa: boolean } {
  const out: { sanEmails: string[]; isCa: boolean } = { sanEmails: [], isCa: false };
  try {
    const wrap = kids.slice(shift + 6).find((k) => k.tag === 0xa3);
    if (!wrap) return out;
    const [seq] = derChildren(cert, wrap);
    if (seq?.tag !== 0x30) return out;
    for (const ext of derChildren(cert, seq)) {
      if (ext.tag !== 0x30) continue;
      const parts = derChildren(cert, ext);
      const value = parts[parts.length - 1];
      if (parts[0]?.tag !== 0x06 || !value || value.tag !== 0x04) continue;
      const oid = decodeOid(cert, parts[0]);
      if (oid === '2.5.29.17') {
        const names = derTlv(cert, value.contentStart);
        if (names.tag !== 0x30 || names.end > value.end) continue;
        for (const gn of derChildren(cert, names)) {
          if (gn.tag === 0x81) out.sanEmails.push(td.decode(cert.slice(gn.contentStart, gn.end)));
        }
      } else if (oid === '2.5.29.19') {
        const bc = derTlv(cert, value.contentStart);
        if (bc.tag !== 0x30 || bc.end > value.end) continue;
        const [ca] = derChildren(cert, bc);
        out.isCa = !!ca && ca.tag === 0x01 && ca.end > ca.contentStart && cert[ca.contentStart] !== 0;
      }
    }
  } catch {  }
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

export type CertSigAlg =
  | { scheme: 'ecdsa'; hash: string }
  | { scheme: 'rsa'; hash: string }
  | { scheme: 'rsa-pss'; hash: string; saltLength: number }
  | { scheme: 'ed25519' };

const SIG_ALGS: Record<string, { scheme: 'ecdsa' | 'rsa'; hash: string }> = {
  '2a8648ce3d040302': { scheme: 'ecdsa', hash: 'SHA-256' },
  '2a8648ce3d040303': { scheme: 'ecdsa', hash: 'SHA-384' },
  '2a8648ce3d040304': { scheme: 'ecdsa', hash: 'SHA-512' },
  '2a864886f70d01010b': { scheme: 'rsa', hash: 'SHA-256' },
  '2a864886f70d01010c': { scheme: 'rsa', hash: 'SHA-384' },
  '2a864886f70d01010d': { scheme: 'rsa', hash: 'SHA-512' },
};
const SIG_OID_RSA_PSS = '2a864886f70d01010a';
const SIG_OID_ED25519 = '2b6570';
const HASH_OIDS: Record<string, string> = {
  '608648016503040201': 'SHA-256', '608648016503040202': 'SHA-384',
  '608648016503040203': 'SHA-512', '2b0e03021a': 'SHA-1',
};

function parseCertSigAlg(cert: Uint8Array, algId: DerTlv): CertSigAlg | null {
  try {
    const kids = derChildren(cert, algId);
    const oidTlv = kids[0];
    if (oidTlv?.tag !== 0x06) return null;
    const oid = hexOf(cert.slice(oidTlv.contentStart, oidTlv.end));
    const fixed = SIG_ALGS[oid];
    if (fixed) return { ...fixed };
    if (oid === SIG_OID_ED25519) return { scheme: 'ed25519' };
    if (oid === SIG_OID_RSA_PSS) {

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

export function parseCertificate(cert: Uint8Array): ParsedCertificate {
  const top = derTlv(cert, 0);

  const topKids = derChildren(cert, top);
  const tbs = topKids[0]!;
  const sigAlgTlv = topKids[1];
  const sigTlv = topKids[2];
  const kids = derChildren(cert, tbs);

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

function ecParamsOf(spki: Uint8Array): { curve: string; hash: string; size: number } | null {
  try {
    const algId = derChildren(spki, derTlv(spki, 0))[0]!;
    const curveOid = derChildren(spki, algId)[1];
    if (curveOid?.tag !== 0x06) return null;
    return EC_CURVES[hexOf(spki.slice(curveOid.contentStart, curveOid.end))] ?? null;
  } catch { return null; }
}

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

    const key = await subtle.importKey('spki', asBufferSource(signer.spki), { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
  } catch { return false; }
}

const OID_RSASSA_PSS = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a);
const ALGID_RSA_ENCRYPTION = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);

function derWrap(tag: number, body: Uint8Array): Uint8Array {
  let head: Uint8Array;
  if (body.length < 0x80) head = Uint8Array.of(tag, body.length);
  else if (body.length < 0x100) head = Uint8Array.of(tag, 0x81, body.length);
  else head = Uint8Array.of(tag, 0x82, body.length >>> 8, body.length & 0xff);
  return concatBytes([head, body]);
}

export function normalizeRsaSpki(spki: Uint8Array): Uint8Array {
  const top = derTlv(spki, 0);
  const [algTlv, keyTlv] = derChildren(spki, top);
  const oid = derTlv(spki, algTlv!.contentStart);
  const oidBytes = spki.slice(oid.start, oid.end);
  if (oidBytes.length !== OID_RSASSA_PSS.length || !oidBytes.every((b, i) => b === OID_RSASSA_PSS[i])) return spki;
  return derWrap(0x30, concatBytes([ALGID_RSA_ENCRYPTION, spki.slice(keyTlv!.start, keyTlv!.end)]));
}
