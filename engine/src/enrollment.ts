// SPDX-License-Identifier: MPL-2.0
/** Device enrollment protocol and pinned certificate profile validation. */
import { asBufferSource, concatBytes } from './bytes.ts';
import { derChildren, derTlv, ecdsaDerToRaw, ecdsaRawToDer, type DerTlv } from './der-read.ts';
import { der, derOid, derSeq, derUint, pemToDer } from './x509.ts';
import { parseCertificate, signedBy, type ParsedCertificate } from './x509-read.ts';

const te = new TextEncoder();
const td = new TextDecoder('utf-8', { fatal: true });
const subtle = globalThis.crypto.subtle;
const SIG_OID = '1.2.840.10045.4.3.2';
const EMAIL_EKU = '1.3.6.1.5.5.7.3.4';
export const ENROLLMENT_VERSION = 2;
export const equalDer = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const hex = (b: Uint8Array): string => Array.from(b, v => v.toString(16).padStart(2, '0')).join('');

function tlv(b: Uint8Array, at = 0, tag = 0x30, end = b.length): DerTlv {
  const t = derTlv(b, at);
  if (t.tag !== tag || t.end !== end || !equalDer(b.slice(t.start, t.end), der(t.tag, b.slice(t.contentStart, t.end)))) throw new Error('Invalid DER structure');
  return t;
}
function children(b: Uint8Array, t: DerTlv, count?: number): DerTlv[] {
  const c = derChildren(b, t);
  for (const v of c) if (!equalDer(b.slice(v.start, v.end), der(v.tag, b.slice(v.contentStart, v.end)))) throw new Error('Noncanonical DER length');
  if (count != null && c.length !== count) throw new Error('Invalid DER field count');
  return c;
}
function oid(b: Uint8Array, t: DerTlv): string {
  if (t.tag !== 0x06 || t.end <= t.contentStart) throw new Error('Invalid object identifier');
  const nums: number[] = [];
  let n = 0;
  let start = true;
  for (const v of b.subarray(t.contentStart, t.end)) {
    if (start && v === 0x80) throw new Error('Noncanonical object identifier');
    n = n * 128 + (v & 127);
    if (!Number.isSafeInteger(n)) throw new Error('Object identifier is too large');
    if (!(v & 128)) { nums.push(n); n = 0; start = true; } else start = false;
  }
  if (!start || !nums.length) throw new Error('Invalid object identifier');
  const first = nums.shift()!;
  return [first < 40 ? 0 : first < 80 ? 1 : 2, first < 80 ? first % 40 : first - 80, ...nums].join('.');
}
function uint(b: Uint8Array, t: DerTlv): number {
  const v = b.subarray(t.contentStart, t.end);
  if (t.tag !== 0x02 || !v.length || v[0]! & 128 || (v.length > 1 && v[0] === 0 && !(v[1]! & 128))) throw new Error('Invalid unsigned integer');
  let n = 0;
  for (const x of v) n = n * 256 + x;
  if (!Number.isSafeInteger(n)) throw new Error('Integer is too large');
  return n;
}
function bool(b: Uint8Array, t: DerTlv): boolean {
  if (t.tag !== 0x01 || t.end - t.contentStart !== 1 || ![0, 255].includes(b[t.contentStart]!)) throw new Error('Invalid DER boolean');
  return b[t.contentStart] === 255;
}
function time(b: Uint8Array, t: DerTlv): Date {
  const s = td.decode(b.subarray(t.contentStart, t.end));
  if (t.tag !== 0x17 && t.tag !== 0x18) throw new Error('Invalid certificate time');
  if (!(t.tag === 0x17 ? /^\d{12}Z$/ : /^\d{14}Z$/).test(s)) throw new Error('Invalid certificate time');
  const y = t.tag === 0x17 ? (+s.slice(0, 2) < 50 ? 2000 : 1900) + +s.slice(0, 2) : +s.slice(0, 4);
  const off = t.tag === 0x17 ? 2 : 4;
  const d = new Date(Date.UTC(y, +s.slice(off, off + 2) - 1, +s.slice(off + 2, off + 4), +s.slice(off + 4, off + 6), +s.slice(off + 6, off + 8), +s.slice(off + 8, off + 10)));
  const canonical = d.toISOString().replace(/[-:T]/g, '').replace('.000Z', 'Z');
  if ((t.tag === 0x17 ? canonical.slice(2) : canonical) !== s) throw new Error('Invalid calendar time');
  return d;
}
async function p256(spki: Uint8Array): Promise<CryptoKey> {
  const [alg, bits] = children(spki, tlv(spki), 2);
  const [ec, curve] = children(spki, alg!, 2);
  if (oid(spki, ec!) !== '1.2.840.10045.2.1' || oid(spki, curve!) !== '1.2.840.10045.3.1.7' || bits!.tag !== 3 || bits!.end - bits!.contentStart !== 66 || spki[bits!.contentStart] !== 0 || spki[bits!.contentStart + 1] !== 4) throw new Error('Device key must be P-256');
  return subtle.importKey('spki', asBufferSource(spki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

/** An empty subject and attributes leave identity and extensions to server policy. */
export async function createEnrollmentCsr(pair: CryptoKeyPair): Promise<Uint8Array> {
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  await p256(spki);
  const info = derSeq(derUint(Uint8Array.of(0)), derSeq(), spki, der(0xa0));
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, asBufferSource(info)));
  return derSeq(info, derSeq(derOid(SIG_OID)), der(3, Uint8Array.of(0), ecdsaRawToDer(sig)));
}

export async function enrollmentProofMessage(token: string, csr: Uint8Array): Promise<Uint8Array> {
  if (typeof token !== 'string' || !token.length || token.length > 8192 || csr.length > 4096) throw new Error('Invalid enrollment proof input');
  const digest = hex(new Uint8Array(await subtle.digest('SHA-256', asBufferSource(csr))));
  return te.encode(JSON.stringify(['lolly-ca/enroll', ENROLLMENT_VERSION, token, digest]));
}

export async function verifyEnrollmentRequest(csr: Uint8Array, spki: Uint8Array, proof: Uint8Array, token: string): Promise<void> {
  if (!csr.length || csr.length > 4096 || proof.length !== 64 || spki.length > 256) throw new Error('Invalid enrollment request size');
  const [info, alg, sig] = children(csr, tlv(csr), 3);
  const [version, subject, publicKey, attrs] = children(csr, info!, 4);
  if (uint(csr, version!) !== 0 || subject!.tag !== 0x30 || subject!.end !== subject!.contentStart || attrs!.tag !== 0xa0 || attrs!.end !== attrs!.contentStart) throw new Error('CSR identity and extensions must be empty');
  if (oid(csr, children(csr, alg!, 1)[0]!) !== SIG_OID || sig!.tag !== 3 || csr[sig!.contentStart] !== 0) throw new Error('Invalid CSR signature algorithm');
  if (!equalDer(csr.slice(publicKey!.start, publicKey!.end), spki)) throw new Error('CSR key does not match device key');
  const key = await p256(spki);
  const sigBytes = csr.slice(sig!.contentStart + 1, sig!.end);
  const raw = ecdsaDerToRaw(sigBytes, 32);
  if (!equalDer(ecdsaRawToDer(raw), sigBytes)) throw new Error('Noncanonical CSR signature');
  if (!await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, asBufferSource(raw), asBufferSource(csr.slice(info!.start, info!.end)))) throw new Error('CSR signature does not verify');
  if (!await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, asBufferSource(proof), asBufferSource(await enrollmentProofMessage(token, csr)))) throw new Error('Enrollment proof does not verify');
}

interface Extension { critical: boolean; bytes: Uint8Array; }
interface Profile {
  parsed: ParsedCertificate; serial: string; extensions: Map<string, Extension>;
  ca: boolean; pathLen?: number; usage: number; eku: string[]; emails: string[]; policies: string[];
  permitted: string[]; excluded: string[];
}
function readExtensions(b: Uint8Array, t: DerTlv): Map<string, Extension> {
  const out = new Map<string, Extension>();
  for (const ext of children(b, t)) {
    const c = children(b, ext);
    if (ext.tag !== 0x30 || c.length < 2 || c.length > 3) throw new Error('Invalid certificate extension');
    const id = oid(b, c[0]!);
    const value = c.at(-1)!;
    if (out.has(id) || value.tag !== 4) throw new Error('Invalid or duplicate certificate extension');
    out.set(id, { critical: c.length === 3 && bool(b, c[1]!), bytes: b.slice(value.contentStart, value.end) });
  }
  return out;
}
function profile(cert: Uint8Array): Profile {
  if (!(cert instanceof Uint8Array) || !cert.length || cert.length > 16384) throw new Error('Invalid certificate size');
  const [tbs, alg, sig] = children(cert, tlv(cert), 3);
  const c = children(cert, tbs!);
  if (c.length !== 8 || c[0]!.tag !== 0xa0 || uint(cert, children(cert, c[0]!, 1)[0]!) !== 2 || c[7]!.tag !== 0xa3) throw new Error('Certificate must have the supported v3 profile');
  if (!equalDer(cert.slice(c[2]!.start, c[2]!.end), cert.slice(alg!.start, alg!.end)) || sig!.tag !== 3 || cert[sig!.contentStart] !== 0) throw new Error('Certificate signature algorithms differ');
  const validity = children(cert, c[4]!, 2);
  const parsed = parseCertificate(cert);
  parsed.notBefore = time(cert, validity[0]!);
  parsed.notAfter = time(cert, validity[1]!);
  const serialBytes = cert.slice(c[1]!.contentStart, c[1]!.end);
  if (c[1]!.tag !== 2 || !serialBytes.length || serialBytes.length > 21 || serialBytes[0]! & 128 || (serialBytes.length > 1 && serialBytes[0] === 0 && !(serialBytes[1]! & 128))) throw new Error('Invalid certificate serial');
  const extensions = readExtensions(cert, children(cert, c[7]!, 1)[0]!);
  const known = ['2.5.29.19', '2.5.29.15', '2.5.29.37', '2.5.29.14', '2.5.29.35', '2.5.29.17', '2.5.29.32', '2.5.29.30', '2.5.29.31', '1.3.6.1.5.5.7.1.1'];
  for (const [id, ext] of extensions) if (ext.critical && (!known.includes(id) || ['2.5.29.31', '1.3.6.1.5.5.7.1.1'].includes(id))) throw new Error('Unsupported critical certificate extension');
  const out: Profile = { parsed, serial: hex(serialBytes).replace(/^00/, ''), extensions, ca: false, usage: 0, eku: [], emails: [], policies: [], permitted: [], excluded: [] };
  const bc = extensions.get('2.5.29.19');
  if (!bc) throw new Error('Missing basic constraints');
  const bcKids = children(bc.bytes, tlv(bc.bytes));
  if (bcKids[0]?.tag === 1) { out.ca = bool(bc.bytes, bcKids[0]); bcKids.shift(); }
  if (bcKids.length) out.pathLen = uint(bc.bytes, bcKids.shift()!);
  if (bcKids.length || (!out.ca && out.pathLen != null)) throw new Error('Invalid basic constraints');
  const ku = extensions.get('2.5.29.15');
  if (!ku?.critical) throw new Error('Missing critical key usage');
  const bits = tlv(ku.bytes, 0, 3);
  const unused = ku.bytes[bits.contentStart]!;
  const usageBytes = ku.bytes.slice(bits.contentStart + 1, bits.end);
  if (!usageBytes.length || usageBytes.length > 2 || unused > 7 || (usageBytes.at(-1)! & ((1 << unused) - 1))) throw new Error('Invalid key usage');
  out.usage = usageBytes[0]! | ((usageBytes[1] ?? 0) << 8);
  const eku = extensions.get('2.5.29.37');
  if (eku) out.eku = children(eku.bytes, tlv(eku.bytes)).map(t => oid(eku.bytes, t));
  const san = extensions.get('2.5.29.17');
  if (san) for (const name of children(san.bytes, tlv(san.bytes))) {
    if (name.tag !== 0x81) throw new Error('Only email subject alternative names are supported');
    const email = td.decode(san.bytes.slice(name.contentStart, name.end));
    if (!/^[\x21-\x7e]+$/.test(email)) throw new Error('Invalid email subject alternative name');
    out.emails.push(email);
  }
  const policies = extensions.get('2.5.29.32');
  if (policies) for (const p of children(policies.bytes, tlv(policies.bytes))) {
    const [id, ...qualifiers] = children(policies.bytes, p);
    if (qualifiers.length) throw new Error('Unsupported policy qualifiers');
    out.policies.push(oid(policies.bytes, id!));
  }
  const nc = extensions.get('2.5.29.30');
  if (nc) {
    if (!nc.critical || !out.ca) throw new Error('Name constraints must be critical on a CA');
    const seen = new Set<number>();
    for (const group of children(nc.bytes, tlv(nc.bytes))) {
      if (![0xa0, 0xa1].includes(group.tag) || seen.has(group.tag)) throw new Error('Invalid name constraints');
      seen.add(group.tag);
      for (const tree of children(nc.bytes, group)) {
        const [base, ...bounds] = children(nc.bytes, tree);
        if (base!.tag !== 0x81 || bounds.length) throw new Error('Unsupported name constraint');
        const value = td.decode(nc.bytes.slice(base!.contentStart, base!.end)).toLowerCase();
        if (!/^(?:\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value) || value.includes('..')) throw new Error('Invalid email domain constraint');
        (group.tag === 0xa0 ? out.permitted : out.excluded).push(value);
      }
    }
  }
  return out;
}
function matchesDomain(email: string, constraint: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return constraint.startsWith('.') ? domain.endsWith(constraint) && domain.length > constraint.length : domain === constraint;
}
function enforceNames(p: Profile, emails: string[]): void {
  for (const email of emails) {
    if (p.permitted.length && !p.permitted.some(d => matchesDomain(email, d))) throw new Error('Identity is outside issuer name constraints');
    if (p.excluded.some(d => matchesDomain(email, d))) throw new Error('Identity is excluded by issuer name constraints');
  }
}
function validAt(p: Profile, now: number): void {
  if (p.parsed.notBefore.getTime() > now || p.parsed.notAfter.getTime() <= now || p.parsed.notAfter <= p.parsed.notBefore) throw new Error('Certificate is outside its validity window');
}
export interface EnrollmentPolicy {
  roots: Uint8Array[];
  issuer: Uint8Array;
  email: string;
  policyOid: string;
  spki?: Uint8Array;
  maxLifetimeSeconds: number;
  now?: number;
}
export async function validateEnrollmentChain(chain: Uint8Array[], policy: EnrollmentPolicy): Promise<{ leaf: ParsedCertificate; serial: string }> {
  if (!Array.isArray(chain) || chain.length < 2 || chain.length > 3 || !policy.roots.length || policy.roots.length > 8 || !Number.isSafeInteger(policy.maxLifetimeSeconds) || policy.maxLifetimeSeconds < 1) throw new Error('Invalid enrollment trust policy');
  if (!equalDer(chain[1]!, policy.issuer)) throw new Error('Certificate issuer is not pinned');
  const leaf = profile(chain[0]!);
  const mid = profile(policy.issuer);
  const now = policy.now ?? Date.now();
  validAt(leaf, now); validAt(mid, now);
  await p256(leaf.parsed.spki); await p256(mid.parsed.spki);
  if (!leaf.parsed.subject.organization || leaf.parsed.subject.commonName !== policy.email || leaf.ca || leaf.usage !== 0x80 || leaf.eku.length !== 1 || leaf.eku[0] !== EMAIL_EKU || leaf.emails.length !== 1 || leaf.emails[0] !== policy.email || leaf.policies.length !== 1 || leaf.policies[0] !== policy.policyOid) throw new Error('Leaf does not match enrollment policy');
  if (policy.spki && !equalDer(leaf.parsed.spki, policy.spki)) throw new Error('Certificate key does not match device key');
  if (!mid.ca || mid.pathLen !== 0 || !mid.extensions.get('2.5.29.19')!.critical || mid.usage !== 6 || !mid.permitted.length || (mid.eku.length && (mid.eku.length !== 1 || mid.eku[0] !== EMAIL_EKU))) throw new Error('Intermediate constraints do not match enrollment policy');
  if (leaf.parsed.notAfter.getTime() - leaf.parsed.notBefore.getTime() > policy.maxLifetimeSeconds * 1000 + 300_000 || leaf.parsed.notAfter > mid.parsed.notAfter || leaf.parsed.notBefore < mid.parsed.notBefore) throw new Error('Leaf lifetime exceeds enrollment policy');
  if (mid.policies.length && !mid.policies.includes(policy.policyOid)) throw new Error('Intermediate certificate policy does not match');
  enforceNames(mid, leaf.emails);
  const ski = mid.extensions.get('2.5.29.14');
  const aki = leaf.extensions.get('2.5.29.35');
  if (!ski || !aki) throw new Error('Missing certificate key identifiers');
  const skiValue = tlv(ski.bytes, 0, 4);
  const akiValue = children(aki.bytes, tlv(aki.bytes), 1)[0]!;
  if (akiValue.tag !== 0x80 || !equalDer(ski.bytes.slice(skiValue.contentStart, skiValue.end), aki.bytes.slice(akiValue.contentStart, akiValue.end))) throw new Error('Certificate authority key identifier does not match');
  if (!await signedBy(leaf.parsed, mid.parsed)) throw new Error('Leaf signature does not verify');
  let matched = false;
  for (const bytes of policy.roots) {
    const root = profile(bytes);
    validAt(root, now);
    if (!root.ca || !root.extensions.get('2.5.29.19')!.critical || !(root.usage & 4) || (root.pathLen != null && root.pathLen < 1) || !root.parsed.selfSigned || !await signedBy(root.parsed, root.parsed)) continue;
    if (chain[2] && !equalDer(bytes, chain[2])) continue;
    if (mid.parsed.notAfter > root.parsed.notAfter || mid.parsed.notBefore < root.parsed.notBefore) continue;
    if ((root.eku.length && !root.eku.includes(EMAIL_EKU)) || (root.policies.length && !root.policies.includes(policy.policyOid))) continue;
    enforceNames(root, leaf.emails);
    if (await signedBy(mid.parsed, root.parsed)) { matched = true; break; }
  }
  if (!matched) throw new Error('Certificate chain does not reach an approved root');
  return { leaf: leaf.parsed, serial: leaf.serial };
}

export interface VerifiedCrl { revokedSerials: string[]; thisUpdate: number; nextUpdate: number; }
export async function validateEnrollmentCrl(crl: Uint8Array, issuer: Uint8Array, maxAgeSeconds: number, now = Date.now()): Promise<VerifiedCrl> {
  if (!(crl instanceof Uint8Array) || !crl.length || crl.length > 1024 * 1024 || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) throw new Error('Invalid CRL size or policy');
  const [tbs, alg, sig] = children(crl, tlv(crl), 3);
  const c = children(crl, tbs!);
  if (c[0]?.tag === 2) { if (uint(crl, c.shift()!) !== 1) throw new Error('Unsupported CRL version'); }
  const [innerAlg, name, current, next, ...tail] = c;
  if (!innerAlg || !name || !current || !next || !equalDer(crl.slice(innerAlg.start, innerAlg.end), crl.slice(alg!.start, alg!.end)) || oid(crl, children(crl, alg!, 1)[0]!) !== SIG_OID || sig!.tag !== 3 || crl[sig!.contentStart] !== 0) throw new Error('Invalid CRL profile');
  const issuing = profile(issuer);
  validAt(issuing, now);
  if (!issuing.ca || !(issuing.usage & 2) || !equalDer(crl.slice(name.start, name.end), issuing.parsed.subjectBytes)) throw new Error('CRL issuer does not match');
  const thisUpdate = time(crl, current).getTime();
  const nextUpdate = time(crl, next).getTime();
  if (thisUpdate > now + 60_000 || now - thisUpdate > maxAgeSeconds * 1000 || nextUpdate <= now || nextUpdate <= thisUpdate) throw new Error('CRL is not fresh');
  const revokedSerials: string[] = [];
  if (tail[0]?.tag === 0x30) {
    for (const entry of children(crl, tail.shift()!)) {
      const entryFields = children(crl, entry);
      if (entryFields.length < 2 || entryFields.length > 3) throw new Error('Invalid CRL entry');
      const [serial, date, ext] = entryFields;
      if (!serial || !date || serial.tag !== 2 || serial.end - serial.contentStart > 21) throw new Error('Invalid CRL entry');
      const serialBytes = crl.slice(serial.contentStart, serial.end);
      if (!serialBytes.length || serialBytes[0]! & 128) throw new Error('Invalid revoked serial');
      time(crl, date);
      if (ext) for (const [id, e] of readExtensions(crl, ext)) if (e.critical || id === '2.5.29.29') throw new Error('Unsupported critical CRL entry extension');
      revokedSerials.push(hex(serialBytes).replace(/^00/, ''));
      if (revokedSerials.length > 20_000) throw new Error('CRL contains too many entries');
    }
  }
  if (tail[0]?.tag === 0xa0) {
    for (const [id, ext] of readExtensions(crl, children(crl, tail.shift()!, 1)[0]!)) if (ext.critical || id === '2.5.29.27' || id === '2.5.29.28') throw new Error('Unsupported CRL extension');
  }
  if (tail.length) throw new Error('Invalid CRL structure');
  const key = await p256(issuing.parsed.spki);
  const sigDer = crl.slice(sig!.contentStart + 1, sig!.end);
  const raw = ecdsaDerToRaw(sigDer, 32);
  if (!equalDer(ecdsaRawToDer(raw), sigDer) || !await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, asBufferSource(raw), asBufferSource(crl.slice(tbs!.start, tbs!.end)))) throw new Error('CRL signature does not verify');
  return { revokedSerials, thisUpdate, nextUpdate };
}

export async function revocationProofMessage(token: string, certificate: Uint8Array): Promise<Uint8Array> {
  if (!token || token.length > 8192 || !certificate.length || certificate.length > 16384) throw new Error('Invalid revocation proof input');
  return concatBytes([te.encode(JSON.stringify(['lolly-ca/revoke', ENROLLMENT_VERSION, token])), Uint8Array.of(0), new Uint8Array(await subtle.digest('SHA-256', asBufferSource(certificate)))]);
}
export const enrollmentCertificateDer = (pem: string): Uint8Array => {
  if (typeof pem !== 'string' || pem.length > 24000 || !/^\s*-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(pem) || (pem.match(/-----BEGIN/g) ?? []).length !== 1) throw new Error('Invalid certificate PEM');
  return pemToDer(pem);
};

export interface EnrollmentProviderPolicy { issuer: string; policyOid: string; domains: string[]; }
export interface EnrollmentTrustBundle {
  version: 1;
  roots: Uint8Array[];
  issuers: Map<string, Uint8Array>;
  providers: Record<string, EnrollmentProviderPolicy>;
  defaultLifetimeSeconds: number;
  maxLifetimeSeconds: number;
  crlMaxAgeSeconds: number;
  unifiedCrl: boolean;
}
/** Public configuration is distributed with the shell, independently of enrollment. */
export function parseEnrollmentTrustBundle(raw: string): EnrollmentTrustBundle {
  if (typeof raw !== 'string' || raw.length > 200_000) throw new Error('Enrollment trust configuration is missing');
  const b = JSON.parse(raw);
  const fields = ['version', 'roots', 'issuers', 'providers', 'defaultLifetimeSeconds', 'maxLifetimeSeconds', 'crlMaxAgeSeconds', 'unifiedCrl'];
  if (!b || typeof b !== 'object' || Object.keys(b).some(k => !fields.includes(k))) throw new Error('Invalid enrollment trust fields');
  if (b?.version !== 1 || !Array.isArray(b.roots) || !b.roots.length || b.roots.length > 8 || !Array.isArray(b.issuers) || !b.issuers.length || b.issuers.length > 8 || typeof b.providers !== 'object' || !b.providers || Array.isArray(b.providers)) throw new Error('Invalid enrollment trust configuration');
  const issuers = new Map<string, Uint8Array>();
  for (const i of b.issuers) {
    if (!i || typeof i !== 'object' || Object.keys(i).some(k => !['id', 'certificate'].includes(k)) || typeof i?.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(i.id) || i.id === 'default' || issuers.has(i.id)) throw new Error('Invalid enrollment issuer');
    issuers.set(i.id, enrollmentCertificateDer(i.certificate));
  }
  const providers: Record<string, EnrollmentProviderPolicy> = Object.create(null);
  if (!Object.keys(b.providers).length || Object.keys(b.providers).length > 8) throw new Error('Enrollment assurance policies are missing');
  for (const [name, value] of Object.entries(b.providers) as [string, EnrollmentProviderPolicy][]) {
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => !['issuer', 'policyOid', 'domains'].includes(k)) || !/^[a-z][a-z0-9_-]{0,31}$/.test(name) || !issuers.has(value?.issuer) || typeof value.policyOid !== 'string' || !/^(?:0|1|2)\.\d+(?:\.\d+){2,20}$/.test(value.policyOid) || value.policyOid === '2.5.29.32.0' || value.policyOid.split('.').some(n => !Number.isSafeInteger(+n) || +n > 0x7fffffff || String(+n) !== n) || (+value.policyOid[0]! < 2 && +value.policyOid.split('.')[1]! > 39) || !Array.isArray(value.domains) || !value.domains.length || value.domains.length > 32 || value.domains.some(d => typeof d !== 'string' || d.length > 253 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(d))) throw new Error('Invalid enrollment assurance policy');
    providers[name] = { issuer: value.issuer, policyOid: value.policyOid, domains: [...new Set(value.domains)] };
  }
  for (const n of ['defaultLifetimeSeconds', 'maxLifetimeSeconds', 'crlMaxAgeSeconds']) if (!Number.isSafeInteger(b[n]) || b[n] < 60 || b[n] > 7 * 86400) throw new Error('Enrollment lifetime and status policies are required');
  if (b.defaultLifetimeSeconds > 86400 || b.defaultLifetimeSeconds > b.maxLifetimeSeconds || b.crlMaxAgeSeconds > b.maxLifetimeSeconds || typeof b.unifiedCrl !== 'boolean') throw new Error('Invalid enrollment lifetime policy');
  return { version: 1, roots: b.roots.map(enrollmentCertificateDer), issuers, providers, defaultLifetimeSeconds: b.defaultLifetimeSeconds, maxLifetimeSeconds: b.maxLifetimeSeconds, crlMaxAgeSeconds: b.crlMaxAgeSeconds, unifiedCrl: b.unifiedCrl };
}

/** Validate a configured identity chain and its independently supplied status. */
export async function validateManagedCredential(chain: Uint8Array[], trust: EnrollmentTrustBundle, crls: Record<string, Uint8Array>, now = Date.now()): Promise<{ issuer: string; serial: string }> {
  if (!chain[0] || !chain[1]) throw new Error('Managed identity chain is incomplete');
  const email = parseCertificate(chain[0]).sanEmails[0];
  if (!email) throw new Error('Managed identity has no email');
  for (const p of Object.values(trust.providers)) {
    const issuer = trust.issuers.get(p.issuer)!;
    if (!equalDer(chain[1], issuer) || !p.domains.includes(email.slice(email.lastIndexOf('@') + 1).toLowerCase())) continue;
    let checked: Awaited<ReturnType<typeof validateEnrollmentChain>>;
    try { checked = await validateEnrollmentChain(chain, { roots: trust.roots, issuer, email, policyOid: p.policyOid, maxLifetimeSeconds: trust.maxLifetimeSeconds, now }); } catch { continue; }
    const status = await validateEnrollmentCrl(crls[p.issuer]!, issuer, trust.crlMaxAgeSeconds, now);
    if (status.revokedSerials.includes(checked.serial)) throw new Error('Managed identity certificate is revoked');
    return { issuer: p.issuer, serial: checked.serial };
  }
  throw new Error('Managed identity does not match an approved issuer policy');
}
