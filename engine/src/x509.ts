// SPDX-License-Identifier: MPL-2.0
/**
 * DER / X.509 authority — pure, DOM-free (globalThis.crypto only; browsers
 * and Node 18+). Extracted from c2pa.js so the on-device C2PA signer, the
 * Lolly CA service and tests share one writer.
 *
 * Two certificate producers live here:
 *   - generateSigner — the ephemeral self-signed credential every offline
 *     export signs with (byte-identical to its previous c2pa.js home; the
 *     c2pa test suite is the regression harness).
 *   - generateCaRoot + issueLeafCert — the identity path: a long-lived
 *     self-signed CA:TRUE root (its private key never enters the repo)
 *     issuing short-lived leaf certificates bound to an OIDC-verified email
 *     (SAN rfc822Name).
 *
 * Both leaf profiles are c2pa-rs-compatible on purpose (spec §14.5.1, hard
 * failures otherwise): the subject carries O= and CN=, the EKU is
 * id-kp-emailProtection (anyExtendedKeyUsage is rejected), keyUsage is
 * digitalSignature critical, and SKI + AKI are present. ES256 P-256 only,
 * matching the COSE alg the C2PA writer hardcodes.
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
// TS 5.7+ widens Uint8Array to Uint8Array<ArrayBufferLike>; WebCrypto wants an
// ArrayBuffer-backed BufferSource. Every buffer here is ArrayBuffer-backed, so
// this is a type-only widening, erased at runtime.
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

type DateInput = Date | string | number | null | undefined;

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ─── DER writers ──────────────────────────────────────────────────────────────

function derLen(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  if (n < 0x100) return Uint8Array.of(0x81, n);
  if (n < 0x10000) return Uint8Array.of(0x82, n >>> 8, n & 0xff);
  return Uint8Array.of(0x83, n >>> 16, (n >>> 8) & 0xff, n & 0xff);
}

export function der(tag: number, ...content: Uint8Array[]): Uint8Array {
  const body = concatBytes(content);
  return concatBytes([Uint8Array.of(tag), derLen(body.length), body]);
}

export const derSeq = (...c: Uint8Array[]): Uint8Array => der(0x30, ...c);
export const derSet = (...c: Uint8Array[]): Uint8Array => der(0x31, ...c);
export const derOctet = (bytes: Uint8Array): Uint8Array => der(0x04, bytes);

// INTEGER from unsigned big-endian bytes: minimal, 0x00-prefixed when the
// high bit is set (DER integers are signed).
export function derUint(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  const v = bytes.subarray(i);
  return v[0]! & 0x80 ? der(0x02, Uint8Array.of(0), v) : der(0x02, v);
}

export function derOid(oid: string): Uint8Array {
  const parts = oid.split('.').map(Number);
  const bytes = [parts[0]! * 40 + parts[1]!];
  for (const p of parts.slice(2)) {
    const grp = [p & 0x7f];
    for (let n = Math.floor(p / 128); n > 0; n = Math.floor(n / 128)) grp.unshift((n & 0x7f) | 0x80);
    bytes.push(...grp);
  }
  return der(0x06, Uint8Array.from(bytes));
}

// UTCTime through 2049, GeneralizedTime after (RFC 5280 §4.1.2.5).
export function derTime(date: Date): Uint8Array {
  const p = (v: number, w = 2): string => String(v).padStart(w, '0');
  const y = date.getUTCFullYear();
  const rest = p(date.getUTCMonth() + 1) + p(date.getUTCDate()) + p(date.getUTCHours()) + p(date.getUTCMinutes()) + p(date.getUTCSeconds()) + 'Z';
  if (y >= 1950 && y < 2050) return der(0x17, te.encode(p(y % 100) + rest));
  return der(0x18, te.encode(p(y, 4) + rest));
}

// WebCrypto ECDSA signatures are raw r||s; X.509 wants DER ECDSA-Sig-Value.
export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  return derSeq(derUint(raw.subarray(0, half)), derUint(raw.subarray(half)));
}

export function asDate(v: DateInput, fallback: number | string): Date {
  const d = v == null ? new Date(fallback) : v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('c2pa: invalid date ' + v);
  return d;
}

// ─── minimal DER reader ───────────────────────────────────────────────────────
// Just enough TLV walking to pull the public-key point out of an SPKI (for
// RFC 5280 key identifiers) and to copy a CA cert's subject Name verbatim;
// c2pa-verify.js owns the full read side.

interface Tlv {
  tag: number;
  start: number;
  contentStart: number;
  end: number;
}

function readTlv(b: Uint8Array, i: number): Tlv {
  if (i + 2 > b.length) throw new Error('x509: truncated DER');
  const tag = b[i]!;
  let len = b[i + 1]!;
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++]!;
  }
  if (j + len > b.length) throw new Error('x509: DER length overruns buffer');
  return { tag, start: i, contentStart: j, end: j + len };
}

function readChildren(b: Uint8Array, tlv: Tlv): Tlv[] {
  const kids: Tlv[] = [];
  let i = tlv.contentStart;
  while (i < tlv.end) {
    const c = readTlv(b, i);
    kids.push(c);
    i = c.end;
  }
  return kids;
}

// RFC 5280 §4.2.1.2 method (1) key identifier: SHA-1 of the subjectPublicKey
// BIT STRING value — which for EC is exactly the raw uncompressed point.
async function keyIdOf(spkiDer: Uint8Array): Promise<Uint8Array> {
  const [, bits] = readChildren(spkiDer, readTlv(spkiDer, 0));
  if (!bits || bits.tag !== 0x03) throw new Error('x509: SPKI has no subjectPublicKey BIT STRING');
  return new Uint8Array(await subtle.digest('SHA-1', asBufferSource(spkiDer.subarray(bits.contentStart + 1, bits.end))));
}

// tbsCertificate: [0] version?, serial, sigAlg, issuer, validity, subject, SPKI, …
function certNameAndKey(certDer: Uint8Array): { subjectBytes: Uint8Array; spkiDer: Uint8Array } {
  const [tbs] = readChildren(certDer, readTlv(certDer, 0));
  const kids = readChildren(certDer, tbs!);
  const shift = kids[0]!.tag === 0xa0 ? 1 : 0;
  return {
    subjectBytes: certDer.slice(kids[shift + 4]!.start, kids[shift + 4]!.end),
    spkiDer: certDer.slice(kids[shift + 5]!.start, kids[shift + 5]!.end),
  };
}

// ─── PEM ──────────────────────────────────────────────────────────────────────

/** PEM text (any '-----BEGIN …-----' block) → DER bytes. */
export function pemToDer(pem: string): Uint8Array {
  const b64 = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  if (!b64) throw new Error('x509: no PEM body found');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DER bytes → PEM with 64-char body lines. label: 'CERTIFICATE' | 'PRIVATE KEY'. */
export function derToPem(der: Uint8Array, label: string): string {
  let bin = '';
  for (let i = 0; i < der.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, der.subarray(i, i + 0x8000) as unknown as number[]);
  }
  const body = btoa(bin).replace(/(.{64})/g, '$1\n').trimEnd();
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

// ─── shared certificate pieces ────────────────────────────────────────────────

const OID_ECDSA_WITH_SHA256 = '1.2.840.10045.4.3.2';
const SIGNER_CN = 'Lolly On-Device Credential';
// Validators surface the subject O as the credential issuer — c2pa-rs errors
// out of signature verification entirely when the attribute is absent.
const SIGNER_O = 'Lolly';

// Positive fixed-width serial (first byte forced into 0x40–0x7f) so the
// cert never needs a 0x00 pad and its size is stable for a given signer.
function randomSerial(): Uint8Array {
  const serial = globalThis.crypto.getRandomValues(new Uint8Array(9));
  serial[0] = (serial[0]! & 0x3f) | 0x40;
  return serial;
}

// X.501 Name with one RDN per attribute, O then CN.
function x501Name(organization: string, commonName: string): Uint8Array {
  return derSeq(
    derSet(derSeq(derOid('2.5.4.10'), der(0x0c, te.encode(organization)))), // organizationName
    derSet(derSeq(derOid('2.5.4.3'), der(0x0c, te.encode(commonName)))), // commonName
  );
}

// Certificate = tbs + algorithm + WebCrypto's raw r||s re-wrapped as a DER
// ECDSA-Sig-Value inside a BIT STRING (0 unused bits).
async function signTbs(tbs: Uint8Array, privateKey: CryptoKey): Promise<Uint8Array> {
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, asBufferSource(tbs)));
  return derSeq(tbs, derSeq(derOid(OID_ECDSA_WITH_SHA256)), der(0x03, Uint8Array.of(0), ecdsaRawToDer(raw)));
}

// ─── ephemeral self-signed signer ─────────────────────────────────────────────

/**
 * Ephemeral on-device signer: a P-256 key pair plus a minimal self-signed
 * X.509 v3 cert (issuer == subject CN, basicConstraints CA:false, keyUsage
 * digitalSignature). dates = { notBefore, notAfter } as Date | ISO string;
 * defaults to now ± 1 year. → { privateKey: CryptoKey, certDer: Uint8Array }
 */
export async function generateSigner(
  dates: { notBefore?: DateInput; notAfter?: DateInput } = {},
): Promise<{ privateKey: CryptoKey; certDer: Uint8Array }> {
  const notBefore = asDate(dates.notBefore, Date.now() - 60_000);
  const notAfter = asDate(dates.notAfter, notBefore.getTime() + 365 * 24 * 3600 * 1000);
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  // RFC 5280 §4.2.1.2 method (1) key identifier: SHA-1 of the subjectPublicKey
  // BIT STRING value — which for EC is exactly the raw uncompressed point.
  const keyId = new Uint8Array(await subtle.digest('SHA-1', new Uint8Array(await subtle.exportKey('raw', pair.publicKey))));
  const serial = randomSerial();
  const name = x501Name(SIGNER_O, SIGNER_CN);
  const algId = derSeq(derOid(OID_ECDSA_WITH_SHA256));
  // The C2PA certificate profile (spec §14.5.1, enforced by c2pa-rs) requires,
  // beyond basicConstraints + keyUsage: an EKU that is present and allowed
  // (emailProtection — anyExtendedKeyUsage is rejected) and an
  // AuthorityKeyIdentifier. SKI is included for AKI's keyid to refer back to.
  const extensions = derSeq(
    derSeq(derOid('2.5.29.19'), derOctet(derSeq())), // basicConstraints: CA absent = false
    derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(7, 0x80)))), // keyUsage: digitalSignature, critical
    derSeq(derOid('2.5.29.37'), derOctet(derSeq(derOid('1.3.6.1.5.5.7.3.4')))), // extKeyUsage: emailProtection
    derSeq(derOid('2.5.29.14'), derOctet(derOctet(keyId))), // subjectKeyIdentifier
    derSeq(derOid('2.5.29.35'), derOctet(derSeq(der(0x80, keyId)))), // authorityKeyIdentifier: [0] keyid
  );
  const tbs = derSeq(
    der(0xa0, derUint(Uint8Array.of(2))), // [0] version: v3
    derUint(serial),
    algId,
    name, // issuer
    derSeq(derTime(notBefore), derTime(notAfter)),
    name, // subject (self-signed)
    spki, // already a DER SubjectPublicKeyInfo
    der(0xa3, extensions),
  );
  const certDer = await signTbs(tbs, pair.privateKey);
  return { privateKey: pair.privateKey, certDer };
}

// ─── CA root + leaf issuance ──────────────────────────────────────────────────

/**
 * Self-signed CA root: X.509 v3, basicConstraints CA:TRUE critical, keyUsage
 * keyCertSign + cRLSign critical, SKI. ES256 P-256. The private key comes
 * back as PKCS#8 DER — custody is the caller's problem (env var / KMS, never
 * the repo). → { certDer: Uint8Array, pkcs8Der: Uint8Array }
 */
export async function generateCaRoot(
  { commonName = 'Lolly CA', organization = 'Lolly', days = 3650 }: { commonName?: string; organization?: string; days?: number } = {},
): Promise<{ certDer: Uint8Array; pkcs8Der: Uint8Array }> {
  const notBefore = new Date(Date.now() - 60_000);
  const notAfter = new Date(notBefore.getTime() + days * 24 * 3600 * 1000);
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const keyId = await keyIdOf(spki);
  const name = x501Name(organization, commonName);
  const extensions = derSeq(
    derSeq(derOid('2.5.29.19'), der(0x01, Uint8Array.of(0xff)), derOctet(derSeq(der(0x01, Uint8Array.of(0xff))))), // basicConstraints: CA:TRUE, critical
    derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(1, 0x06)))), // keyUsage: keyCertSign | cRLSign, critical
    derSeq(derOid('2.5.29.14'), derOctet(derOctet(keyId))), // subjectKeyIdentifier
  );
  const tbs = derSeq(
    der(0xa0, derUint(Uint8Array.of(2))), // [0] version: v3
    derUint(randomSerial()),
    derSeq(derOid(OID_ECDSA_WITH_SHA256)),
    name, // issuer == subject (self-signed root)
    derSeq(derTime(notBefore), derTime(notAfter)),
    name,
    spki,
    der(0xa3, extensions),
  );
  const certDer = await signTbs(tbs, pair.privateKey);
  const pkcs8Der = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  return { certDer, pkcs8Der };
}

/**
 * Issue a short-lived leaf certificate for a device public key (CSR-less —
 * the caller has already verified proof-of-possession). The issuer Name is
 * the CA cert's subject bytes copied VERBATIM, so chain verification's
 * byte-exact issuer/subject comparison holds by construction.
 *
 *   caCertDer     the CA certificate (DER)
 *   caPrivateKey  CryptoKey, or PKCS#8 DER bytes (imported here)
 *   spkiDer       the subject's public key as DER SubjectPublicKeyInfo
 *   email         verified identity → SAN rfc822Name (and the default CN)
 *   days          leaf lifetime from now (default 7);
 *                 notBefore / notAfter (Date | ISO string) override it
 *
 * → Uint8Array (leaf certificate DER)
 */
export async function issueLeafCert({
  caCertDer,
  caPrivateKey,
  spkiDer,
  email,
  commonName,
  organization = 'Lolly',
  days = 7,
  notBefore,
  notAfter,
}: {
  caCertDer?: Uint8Array;
  caPrivateKey?: CryptoKey | Uint8Array;
  spkiDer?: Uint8Array;
  email?: string;
  commonName?: string;
  organization?: string;
  days?: number;
  notBefore?: DateInput;
  notAfter?: DateInput;
} = {}): Promise<Uint8Array> {
  if (!(caCertDer instanceof Uint8Array)) throw new Error('x509: caCertDer must be a Uint8Array');
  if (!(spkiDer instanceof Uint8Array)) throw new Error('x509: spkiDer must be a Uint8Array');
  if (!email) throw new Error('x509: email is required');
  const nb = asDate(notBefore, Date.now() - 60_000);
  const na = asDate(notAfter, nb.getTime() + days * 24 * 3600 * 1000);
  const signKey = caPrivateKey instanceof Uint8Array
    ? await subtle.importKey('pkcs8', asBufferSource(caPrivateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    : caPrivateKey!;
  const ca = certNameAndKey(caCertDer);
  const keyId = await keyIdOf(spkiDer);
  const issuerKeyId = await keyIdOf(ca.spkiDer);
  const extensions = derSeq(
    derSeq(derOid('2.5.29.19'), derOctet(derSeq())), // basicConstraints: CA absent = false
    derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(7, 0x80)))), // keyUsage: digitalSignature, critical
    derSeq(derOid('2.5.29.37'), derOctet(derSeq(derOid('1.3.6.1.5.5.7.3.4')))), // extKeyUsage: emailProtection
    derSeq(derOid('2.5.29.14'), derOctet(derOctet(keyId))), // subjectKeyIdentifier
    derSeq(derOid('2.5.29.35'), derOctet(derSeq(der(0x80, issuerKeyId)))), // authorityKeyIdentifier: [0] keyid
    derSeq(derOid('2.5.29.17'), derOctet(derSeq(der(0x81, te.encode(String(email)))))), // subjectAltName: rfc822Name
  );
  const tbs = derSeq(
    der(0xa0, derUint(Uint8Array.of(2))), // [0] version: v3
    derUint(randomSerial()),
    derSeq(derOid(OID_ECDSA_WITH_SHA256)),
    ca.subjectBytes, // issuer, byte-identical to the CA's subject
    derSeq(derTime(nb), derTime(na)),
    x501Name(organization, commonName || String(email)),
    spkiDer, // already a DER SubjectPublicKeyInfo
    der(0xa3, extensions),
  );
  return signTbs(tbs, signKey);
}
