// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) manifest builder + PDF embedder — pure, DOM-free.
 *
 * Example-grade but spec-shaped C2PA v1: a JUMBF (ISO 19566-5) store holding
 * one manifest (assertion store + CBOR claim + COSE_Sign1 claim signature),
 * signed with an ephemeral on-device self-signed ECDSA P-256 certificate.
 * Validators parse the structure but report the signer as unknown/untrusted —
 * that is the intended trust posture: no real credential ever leaves the
 * device, so what must be right is the container, not the chain.
 *
 * Hand-rolled on purpose (no npm deps; globalThis.crypto only — browsers and
 * Node 18+):
 *   - deterministic definite-length CBOR (the subset the claim needs),
 *   - JUMBF box writer (c2pa / c2ma / c2as / c2cl / c2cs box UUIDs + labels),
 *   - COSE_Sign1 ES256 with detached payload (payload == the CBOR claim
 *     bytes; the COSE array itself carries null),
 *   - minimal X.509 v3 self-signed cert. WebCrypto ECDSA emits raw r||s,
 *     which is exactly what COSE wants; X.509 wants a DER ECDSA-Sig-Value,
 *     so the cert signature is re-wrapped and the COSE one is not.
 *   - classic-xref PDF incremental update attaching the manifest as an
 *     associated embedded file (/AF + /Names→/EmbeddedFiles). The original
 *     bytes are preserved as a byte-identical prefix (asserted).
 *
 * The hard binding (c2pa.hash.data) hashes the FINAL file with the manifest's
 * own byte range OMITTED (C2PA exclusions skip ranges — they do not zero
 * them), which forces the two-pass layout in embedC2paInPdf: freeze the byte
 * layout around a placeholder manifest of the exact final length, hash, then
 * rebuild with the real digest. Only fixed-width fields (32-byte hashes,
 * 64-byte raw signature) differ between passes, so the length holds by
 * construction; the hash assertion's `pad` field absorbs any residual drift.
 *
 * Like emf.js / eps.js this is a format authority: no DOM, no Handlebars, no
 * ajv — fully node:test-able.
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// ─── bytes ────────────────────────────────────────────────────────────────────

function concatBytes(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function sha256(bytes) {
  return new Uint8Array(await subtle.digest('SHA-256', bytes));
}

// ─── CBOR (RFC 8949 subset: definite lengths, shortest-form heads) ────────────

/** Wrapper for CBOR major type 6, e.g. new CborTag(18, coseArray). */
export class CborTag {
  constructor(tag, value) { this.tag = tag; this.value = value; }
}

function cborHead(major, n) {
  const m = major << 5;
  if (n < 24) return Uint8Array.of(m | n);
  if (n < 0x100) return Uint8Array.of(m | 24, n);
  if (n < 0x10000) return Uint8Array.of(m | 25, n >>> 8, n & 0xff);
  if (n < 0x100000000) return Uint8Array.of(m | 26, n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  const out = new Uint8Array(9);
  out[0] = m | 27;
  new DataView(out.buffer).setBigUint64(1, BigInt(n));
  return out;
}

function cborEncodeInto(value, out) {
  if (value === null) { out.push(Uint8Array.of(0xf6)); return; }
  if (value === true) { out.push(Uint8Array.of(0xf5)); return; }
  if (value === false) { out.push(Uint8Array.of(0xf4)); return; }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('cbor: only safe integers are supported, got ' + value);
    out.push(value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value));
    return;
  }
  if (typeof value === 'string') {
    const b = te.encode(value);
    out.push(cborHead(3, b.length), b);
    return;
  }
  if (value instanceof Uint8Array) { out.push(cborHead(2, value.length), value); return; }
  if (Array.isArray(value)) {
    out.push(cborHead(4, value.length));
    for (const v of value) cborEncodeInto(v, out);
    return;
  }
  if (value instanceof CborTag) {
    out.push(cborHead(6, value.tag));
    cborEncodeInto(value.value, out);
    return;
  }
  if (value instanceof Map) {
    out.push(cborHead(5, value.size));
    for (const [k, v] of value) { cborEncodeInto(k, out); cborEncodeInto(v, out); }
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    out.push(cborHead(5, keys.length));
    for (const k of keys) { cborEncodeInto(k, out); cborEncodeInto(value[k], out); }
    return;
  }
  throw new Error('cbor: unsupported value type ' + typeof value);
}

/**
 * Encode a JS value as deterministic definite-length CBOR. Maps and objects
 * keep insertion order; use Map for non-string keys (COSE header labels).
 */
export function encodeCbor(value) {
  const out = [];
  cborEncodeInto(value, out);
  return concatBytes(out);
}

// ─── JUMBF (ISO 19566-5 boxes, C2PA 1.x labels + UUIDs) ───────────────────────

// C2PA box-type UUIDs are 4 ASCII chars + this fixed ISO suffix; the 'cbor'
// UUID is the ISO CBOR content-type, used both for CBOR assertions' jumd and
// implied by their 'cbor' content boxes.
const JUMBF_UUID_SUFFIX = [0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
const boxUuid = (fourcc) =>
  Uint8Array.of(fourcc.charCodeAt(0), fourcc.charCodeAt(1), fourcc.charCodeAt(2), fourcc.charCodeAt(3), ...JUMBF_UUID_SUFFIX);

const UUID_C2PA_STORE = boxUuid('c2pa');      // store superbox, label 'c2pa'
const UUID_MANIFEST = boxUuid('c2ma');        // manifest superbox, label 'urn:uuid:…'
const UUID_ASSERTION_STORE = boxUuid('c2as'); // label 'c2pa.assertions'
const UUID_CLAIM = boxUuid('c2cl');           // label 'c2pa.claim'
const UUID_SIGNATURE = boxUuid('c2cs');       // label 'c2pa.signature'
const UUID_CBOR_CONTENT = boxUuid('cbor');    // CBOR assertions

// [u32 length | 4-char type | payload]; length covers the 8-byte header.
function isoBox(type, ...payloads) {
  const body = concatBytes(payloads);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(body, 8);
  return out;
}

// Superbox = jumb[ jumd(UUID + toggles + NUL-terminated label), children… ].
// Toggles 0x03 = requestable | label present.
function jumbfSuperbox(uuid, label, ...children) {
  const jumd = isoBox('jumd', uuid, Uint8Array.of(0x03), te.encode(label), Uint8Array.of(0));
  return isoBox('jumb', jumd, ...children);
}

// ─── DER / X.509 ──────────────────────────────────────────────────────────────

function derLen(n) {
  if (n < 0x80) return Uint8Array.of(n);
  if (n < 0x100) return Uint8Array.of(0x81, n);
  if (n < 0x10000) return Uint8Array.of(0x82, n >>> 8, n & 0xff);
  return Uint8Array.of(0x83, n >>> 16, (n >>> 8) & 0xff, n & 0xff);
}

function der(tag, ...content) {
  const body = concatBytes(content);
  return concatBytes([Uint8Array.of(tag), derLen(body.length), body]);
}

const derSeq = (...c) => der(0x30, ...c);
const derSet = (...c) => der(0x31, ...c);
const derOctet = (bytes) => der(0x04, bytes);

// INTEGER from unsigned big-endian bytes: minimal, 0x00-prefixed when the
// high bit is set (DER integers are signed).
function derUint(bytes) {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  const v = bytes.subarray(i);
  return v[0] & 0x80 ? der(0x02, Uint8Array.of(0), v) : der(0x02, v);
}

function derOid(oid) {
  const parts = oid.split('.').map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const grp = [p & 0x7f];
    for (let n = Math.floor(p / 128); n > 0; n = Math.floor(n / 128)) grp.unshift((n & 0x7f) | 0x80);
    bytes.push(...grp);
  }
  return der(0x06, Uint8Array.from(bytes));
}

// UTCTime through 2049, GeneralizedTime after (RFC 5280 §4.1.2.5).
function derTime(date) {
  const p = (v, w = 2) => String(v).padStart(w, '0');
  const y = date.getUTCFullYear();
  const rest = p(date.getUTCMonth() + 1) + p(date.getUTCDate()) + p(date.getUTCHours()) + p(date.getUTCMinutes()) + p(date.getUTCSeconds()) + 'Z';
  if (y >= 1950 && y < 2050) return der(0x17, te.encode(p(y % 100) + rest));
  return der(0x18, te.encode(p(y, 4) + rest));
}

// WebCrypto ECDSA signatures are raw r||s; X.509 wants DER ECDSA-Sig-Value.
function ecdsaRawToDer(raw) {
  const half = raw.length / 2;
  return derSeq(derUint(raw.subarray(0, half)), derUint(raw.subarray(half)));
}

function asDate(v, fallback) {
  const d = v == null ? new Date(fallback) : v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('c2pa: invalid date ' + v);
  return d;
}

const OID_ECDSA_WITH_SHA256 = '1.2.840.10045.4.3.2';
const SIGNER_CN = 'Lolly On-Device Credential';

/**
 * Ephemeral on-device signer: a P-256 key pair plus a minimal self-signed
 * X.509 v3 cert (issuer == subject CN, basicConstraints CA:false, keyUsage
 * digitalSignature). dates = { notBefore, notAfter } as Date | ISO string;
 * defaults to now ± 1 year. → { privateKey: CryptoKey, certDer: Uint8Array }
 */
export async function generateSigner(dates = {}) {
  const notBefore = asDate(dates.notBefore, Date.now() - 60_000);
  const notAfter = asDate(dates.notAfter, notBefore.getTime() + 365 * 24 * 3600 * 1000);
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  // Positive fixed-width serial (first byte forced into 0x40–0x7f) so the
  // cert never needs a 0x00 pad and its size is stable for a given signer.
  const serial = globalThis.crypto.getRandomValues(new Uint8Array(9));
  serial[0] = (serial[0] & 0x3f) | 0x40;
  const name = derSeq(derSet(derSeq(derOid('2.5.4.3'), der(0x0c, te.encode(SIGNER_CN)))));
  const algId = derSeq(derOid(OID_ECDSA_WITH_SHA256));
  const extensions = derSeq(
    derSeq(derOid('2.5.29.19'), derOctet(derSeq())), // basicConstraints: CA absent = false
    derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(7, 0x80)))), // keyUsage: digitalSignature, critical
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
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, tbs));
  const certDer = derSeq(tbs, algId, der(0x03, Uint8Array.of(0), ecdsaRawToDer(raw)));
  return { privateKey: pair.privateKey, certDer };
}

// ─── COSE_Sign1 (RFC 9052 / 9360) ─────────────────────────────────────────────

const COSE_HEADER_ALG = 1;      // ES256 = -7
const COSE_HEADER_X5CHAIN = 33; // array of DER certs, leaf first

// Detached payload: the COSE_Sign1 array carries null; the Signature1
// Sig_structure carries the claim bytes. Signature stays raw r||s per COSE.
async function coseSign1Detached(signer, payload) {
  const protectedBytes = encodeCbor(new Map([
    [COSE_HEADER_ALG, -7],
    [COSE_HEADER_X5CHAIN, [signer.certDer]],
  ]));
  const sigStructure = encodeCbor(['Signature1', protectedBytes, new Uint8Array(0), payload]);
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.privateKey, sigStructure));
  return encodeCbor(new CborTag(18, [protectedBytes, new Map(), null, raw])); // COSE_Sign1_Tagged
}

// ─── manifest ─────────────────────────────────────────────────────────────────

function urnUuid() {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// xsd:dateTime at fixed (second) precision so manifest length is date-stable.
const isoSeconds = (d) => d.toISOString().slice(0, 19) + 'Z';

/**
 * Build a complete C2PA v1 JUMBF store (→ Uint8Array).
 *
 * Assertions: c2pa.actions (one c2pa.created action with softwareAgent =
 * claimGenerator and when = dates.signedAt) and the c2pa.hash.data hard
 * binding carrying assetHash verbatim:
 *   assetHash = { exclusions: [{start, length}], name?, alg?, hash: Uint8Array, pad?: Uint8Array }
 * The claim references each assertion by hashed URI — a JUMBF URI relative to
 * the manifest plus sha256 over the assertion's entire superbox (header
 * included).
 *
 * `signer` / `manifestLabel` / `instanceId` are optional and exist so
 * embedC2paInPdf (and tests) can hold them constant across the two-pass
 * layout; fresh ones are generated when absent.
 */
export async function buildC2paManifest({
  title,
  claimGenerator,
  assetHash,
  format = 'application/pdf',
  dates = {},
  signer,
  manifestLabel,
  instanceId,
} = {}) {
  if (!assetHash || !(assetHash.hash instanceof Uint8Array) || !Array.isArray(assetHash.exclusions)) {
    throw new Error('c2pa: assetHash requires { exclusions: [{start, length}], hash: Uint8Array }');
  }
  const signedAt = asDate(dates.signedAt, Date.now());
  const sig = signer || (await generateSigner(dates));

  const actions = {
    actions: [{ action: 'c2pa.created', softwareAgent: String(claimGenerator || 'Lolly'), when: isoSeconds(signedAt) }],
  };
  const hashData = {
    exclusions: assetHash.exclusions.map((e) => ({ start: e.start, length: e.length })),
    name: assetHash.name || 'jumbf manifest',
    alg: assetHash.alg || 'sha256',
    hash: assetHash.hash,
    pad: assetHash.pad || new Uint8Array(0),
  };
  const actionsBox = jumbfSuperbox(UUID_CBOR_CONTENT, 'c2pa.actions', isoBox('cbor', encodeCbor(actions)));
  const hashBox = jumbfSuperbox(UUID_CBOR_CONTENT, 'c2pa.hash.data', isoBox('cbor', encodeCbor(hashData)));
  const assertionStore = jumbfSuperbox(UUID_ASSERTION_STORE, 'c2pa.assertions', actionsBox, hashBox);

  const claim = {
    'dc:title': String(title || 'Untitled'),
    'dc:format': format,
    instanceID: instanceId || urnUuid(),
    claim_generator: String(claimGenerator || 'Lolly'),
    signature: 'self#jumbf=c2pa.signature',
    assertions: [
      { url: 'self#jumbf=c2pa.assertions/c2pa.actions', hash: await sha256(actionsBox) },
      { url: 'self#jumbf=c2pa.assertions/c2pa.hash.data', hash: await sha256(hashBox) },
    ],
    alg: 'sha256',
  };
  const claimBytes = encodeCbor(claim);
  const claimBox = jumbfSuperbox(UUID_CLAIM, 'c2pa.claim', isoBox('cbor', claimBytes));
  const signatureBox = jumbfSuperbox(UUID_SIGNATURE, 'c2pa.signature', isoBox('cbor', await coseSign1Detached(sig, claimBytes)));
  const manifest = jumbfSuperbox(UUID_MANIFEST, manifestLabel || urnUuid(), assertionStore, claimBox, signatureBox);
  return jumbfSuperbox(UUID_C2PA_STORE, 'c2pa', manifest);
}

// ─── PDF incremental update ───────────────────────────────────────────────────

// Byte-transparent binary string. TextDecoder('latin1') is really
// windows-1252 (remaps 0x80–0x9f), so both directions are hand-rolled.
function bytesToBin(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return s;
}

function binToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const PDF_WS = ' \t\r\n\f\0';
const PDF_DELIM = ' \t\r\n\f\0()<>[]{}/%';

function skipWs(s, i) {
  while (i < s.length && PDF_WS.includes(s[i])) i++;
  return i;
}

function literalStringEnd(s, i) {
  let p = 1;
  i++;
  while (i < s.length && p > 0) {
    if (s[i] === '\\') i += 2;
    else {
      if (s[i] === '(') p++;
      else if (s[i] === ')') p--;
      i++;
    }
  }
  if (p !== 0) throw new Error('C2PA embed: unterminated PDF string');
  return i;
}

// End (exclusive) of a composite value starting at i ('<<' or '['). Skips
// literal strings (escapes + nested parens), hex strings and comments.
function compositeEnd(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') i = literalStringEnd(s, i);
    else if (c === '<' && s[i + 1] === '<') { depth++; i += 2; }
    else if (c === '>' && s[i + 1] === '>') { depth--; i += 2; if (depth === 0) return i; }
    else if (c === '<') { const j = s.indexOf('>', i); if (j < 0) break; i = j + 1; }
    else if (c === '[') { depth++; i++; }
    else if (c === ']') { depth--; i++; if (depth === 0) return i; }
    else if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; }
    else i++;
  }
  throw new Error('C2PA embed: unbalanced PDF value');
}

// End (exclusive) of any PDF value starting at i (whitespace already skipped).
function valueEnd(s, i) {
  const c = s[i];
  if ((c === '<' && s[i + 1] === '<') || c === '[') return compositeEnd(s, i);
  if (c === '<') {
    const j = s.indexOf('>', i);
    if (j < 0) throw new Error('C2PA embed: unterminated hex string');
    return j + 1;
  }
  if (c === '(') return literalStringEnd(s, i);
  if (c === '/') {
    let j = i + 1;
    while (j < s.length && !PDF_DELIM.includes(s[j])) j++;
    return j;
  }
  const ref = /^\d+\s+\d+\s+R(?![A-Za-z0-9])/.exec(s.slice(i, i + 32));
  if (ref) return i + ref[0].length;
  const tok = /^[^\s()<>[\]{}/%]+/.exec(s.slice(i, i + 128));
  if (tok) return i + tok[0].length;
  throw new Error('C2PA embed: cannot parse PDF value');
}

// Top-level key/value spans of an inline dict source ('<<…>>', offsets into src).
function dictEntries(src) {
  const entries = [];
  let i = skipWs(src, 2);
  while (i < src.length) {
    if (src[i] === '>' && src[i + 1] === '>') break;
    if (src[i] !== '/') throw new Error('C2PA embed: malformed PDF dictionary');
    let j = i + 1;
    while (j < src.length && !PDF_DELIM.includes(src[j])) j++;
    const key = src.slice(i + 1, j);
    const valStart = skipWs(src, j);
    const valEnd = valueEnd(src, valStart);
    entries.push({ key, valStart, valEnd });
    i = skipWs(src, valEnd);
  }
  return entries;
}

// One classic xref section at `off`: entries + raw trailer dict + /Prev.
// Cross-reference *streams* (PDF 1.5+) start with "N G obj" instead — those
// get a distinct error the shell maps to "cannot attach".
function parseXrefSection(bin, off) {
  let i = skipWs(bin, off);
  if (!bin.startsWith('xref', i)) {
    if (/^\d+\s+\d+\s+obj\b/.test(bin.slice(i, i + 32))) {
      throw new Error('C2PA embed: PDF uses a cross-reference stream (PDF 1.5+); cannot attach');
    }
    throw new Error('C2PA embed: startxref does not point at a cross-reference table');
  }
  i = skipWs(bin, i + 4);
  const entries = [];
  while (!bin.startsWith('trailer', i)) {
    const head = /^(\d+)[ \t]+(\d+)/.exec(bin.slice(i, i + 40));
    if (!head) throw new Error('C2PA embed: malformed cross-reference subsection');
    const start = +head[1];
    const count = +head[2];
    i = skipWs(bin, i + head[0].length);
    for (let k = 0; k < count; k++) {
      const e = /^(\d{10}) (\d{5}) ([nf])/.exec(bin.slice(i, i + 20));
      if (!e) throw new Error('C2PA embed: malformed cross-reference entry');
      entries.push({ num: start + k, offset: +e[1], gen: +e[2], type: e[3] });
      i = skipWs(bin, i + 18);
    }
  }
  i = skipWs(bin, i + 7);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: malformed trailer');
  const trailer = bin.slice(i, compositeEnd(bin, i));
  const prev = /\/Prev\s+(\d+)/.exec(trailer);
  return { entries, trailer, prev: prev ? +prev[1] : null };
}

function parsePdf(bin) {
  if (!bin.startsWith('%PDF-')) throw new Error('C2PA embed: not a PDF');
  const sxAt = bin.lastIndexOf('startxref');
  const sx = sxAt < 0 ? null : /^startxref\s+(\d+)/.exec(bin.slice(sxAt, sxAt + 40));
  if (!sx) throw new Error('C2PA embed: missing startxref');
  const startxref = +sx[1];
  const entries = new Map(); // first seen wins — the chain walks newest → oldest
  const trailers = [];
  const seen = new Set();
  for (let off = startxref; off != null && !seen.has(off); ) {
    seen.add(off);
    const sec = parseXrefSection(bin, off);
    for (const e of sec.entries) if (!entries.has(e.num)) entries.set(e.num, e);
    trailers.push(sec.trailer);
    off = sec.prev;
  }
  let root = null;
  for (const t of trailers) {
    const m = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(t);
    if (m) { root = { num: +m[1], gen: +m[2] }; break; }
  }
  if (!root) throw new Error('C2PA embed: trailer has no /Root');
  const sizeM = /\/Size\s+(\d+)/.exec(trailers[0]);
  let maxNum = sizeM ? +sizeM[1] - 1 : 0;
  for (const n of entries.keys()) if (n > maxNum) maxNum = n;
  const infoM = /\/Info\s+\d+\s+\d+\s+R/.exec(trailers[0]);
  const idM = /\/ID\s*\[[^\]]*\]/.exec(trailers[0]);
  return { startxref, entries, root, maxNum, infoRaw: infoM ? infoM[0] : null, idRaw: idM ? idM[0] : null };
}

// The Catalog dict source, via the xref entry for /Root (raw scan fallback
// for slightly-off offsets — some writers pad or shift by an EOL).
function catalogSource(bin, info) {
  const { num, gen } = info.root;
  const headRe = new RegExp(`^${num}\\s+${gen}\\s+obj\\b`);
  let at = -1;
  const entry = info.entries.get(num);
  if (entry && entry.type === 'n') {
    const i = skipWs(bin, entry.offset);
    if (headRe.test(bin.slice(i, i + 32))) at = i;
  }
  if (at < 0) {
    const re = new RegExp(`(?:^|[^0-9])(${num}\\s+${gen}\\s+obj)\\b`, 'g');
    for (let m; (m = re.exec(bin)); ) at = m.index + m[0].length - m[1].length; // last = newest revision
  }
  if (at < 0) throw new Error('C2PA embed: cannot locate the PDF Catalog object');
  const objM = /^\d+\s+\d+\s+obj/.exec(bin.slice(at, at + 32));
  const i = skipWs(bin, at + objM[0].length);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: Catalog object is not a dictionary');
  const src = bin.slice(i, compositeEnd(bin, i));
  if (!/\/Type\s*\/Catalog\b/.test(src)) throw new Error('C2PA embed: /Root object is not a /Catalog');
  return src;
}

// Clone the Catalog dict source with /AF + /Names→/EmbeddedFiles attached.
// Inline values are merged in place; an indirect /Names, indirect /AF or a
// pre-existing /EmbeddedFiles tree is out of scope → clear "cannot attach".
function catalogWithAttachment(src, fsRef) {
  const efEntry = `/EmbeddedFiles << /Names [(manifest.c2pa) ${fsRef}] >>`;
  const entries = dictEntries(src);
  const find = (k) => entries.find((e) => e.key === k);
  const edits = [];
  const names = find('Names');
  if (names) {
    const val = src.slice(names.valStart, names.valEnd);
    if (!val.startsWith('<<')) throw new Error('C2PA embed: catalog /Names is an indirect object; cannot attach');
    if (dictEntries(val).some((e) => e.key === 'EmbeddedFiles')) {
      throw new Error('C2PA embed: PDF already has an /EmbeddedFiles name tree; cannot attach');
    }
    edits.push({ at: names.valEnd - 2, text: ` ${efEntry} ` });
  }
  const af = find('AF');
  if (af) {
    if (src[af.valStart] !== '[') throw new Error('C2PA embed: catalog /AF is not an inline array; cannot attach');
    edits.push({ at: af.valEnd - 1, text: ` ${fsRef}` });
  }
  let tailAdd = '';
  if (!af) tailAdd += ` /AF [${fsRef}]`;
  if (!names) tailAdd += ` /Names << ${efEntry} >>`;
  if (tailAdd) edits.push({ at: src.length - 2, text: tailAdd + ' ' });
  let out = src;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return out;
}

// "nnnnnnnnnn ggggg n\r\n" — exactly the 20-byte classic xref entry.
const xrefEntryLine = (offset, gen) => `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} n\r\n`;

/**
 * Attach a C2PA manifest to a PDF as an incremental update: the original
 * bytes are kept as a byte-identical prefix (asserted), then an updated
 * Catalog (same object number + generation, /AF + /Names→/EmbeddedFiles), a
 * /Filespec with /AFRelationship /C2PA_Manifest, the manifest as an
 * /EmbeddedFile stream, a classic xref section and a trailer whose /Prev
 * points at the original startxref. Requires a classic cross-reference
 * table (jsPDF-style); cross-reference streams throw a clear Error the
 * shell treats as "cannot attach".
 */
export async function embedC2paInPdf(pdfBytes, { title, claimGenerator, dates = {} } = {}) {
  if (!(pdfBytes instanceof Uint8Array)) throw new Error('C2PA embed: pdfBytes must be a Uint8Array');
  const bin = bytesToBin(pdfBytes);
  const info = parsePdf(bin);
  const fsNum = info.maxNum + 1; // FileSpec dict
  const efNum = info.maxNum + 2; // EmbeddedFile stream
  const fsRef = `${fsNum} 0 R`;
  const catalog = catalogWithAttachment(catalogSource(bin, info), fsRef);

  const sep = bin.endsWith('\n') || bin.endsWith('\r') ? '' : '\n';
  const catObj = `${info.root.num} ${info.root.gen} obj\n${catalog}\nendobj\n`;
  const fsObj = `${fsNum} 0 obj\n<< /Type /Filespec /F (manifest.c2pa) /UF (manifest.c2pa) /AFRelationship /C2PA_Manifest /EF << /F ${efNum} 0 R >> >>\nendobj\n`;
  const afterStream = '\nendstream\nendobj\n';
  const trailerExtra = (info.infoRaw ? ' ' + info.infoRaw : '') + (info.idRaw ? ' ' + info.idRaw : '');

  // Full incremental-update layout for a manifest of exactly `manifestLen`
  // bytes. Only /Length's digit count and the startxref value vary with the
  // manifest length; xref entry offsets are fixed-width by format.
  const layoutFor = (manifestLen) => {
    const catOff = pdfBytes.length + sep.length;
    const fsOff = catOff + catObj.length;
    const efOff = fsOff + fsObj.length;
    const head = sep + catObj + fsObj +
      `${efNum} 0 obj\n<< /Type /EmbeddedFile /Subtype /application#2Fc2pa /Length ${manifestLen} >>\nstream\n`;
    const manifestOffset = pdfBytes.length + head.length;
    const xrefOff = manifestOffset + manifestLen + afterStream.length;
    const tail = afterStream +
      'xref\n' +
      `${info.root.num} 1\n` + xrefEntryLine(catOff, info.root.gen) +
      `${fsNum} 2\n` + xrefEntryLine(fsOff, 0) + xrefEntryLine(efOff, 0) +
      `trailer\n<< /Size ${efNum + 1} /Root ${info.root.num} ${info.root.gen} R /Prev ${info.startxref}${trailerExtra} >>\n` +
      `startxref\n${xrefOff}\n%%EOF\n`;
    return { head, tail, manifestOffset };
  };

  // Signer, manifest label and instanceID are held constant across passes so
  // the manifest length is deterministic given input lengths.
  const signer = await generateSigner(dates);
  const internals = { signer, manifestLabel: urnUuid(), instanceId: urnUuid() };
  const pad = new Uint8Array(8);
  const dummyHash = new Uint8Array(32);
  const build = (hash, exclusions, padBytes) => buildC2paManifest({
    title, claimGenerator, dates, format: 'application/pdf',
    assetHash: { exclusions, hash, pad: padBytes },
    ...internals,
  });

  // Pass 1: freeze the layout. Manifest length depends on the layout only
  // through the CBOR widths of exclusion start/length, so iterate to a fixed
  // point (converges in one round unless a width boundary is crossed).
  let manifestLen = (await build(dummyHash, [{ start: pdfBytes.length + 512, length: 4096 }], pad)).length;
  let layout = null;
  let placeholder = null;
  for (let round = 0; round < 8 && !placeholder; round++) {
    const l = layoutFor(manifestLen);
    const m = await build(dummyHash, [{ start: l.manifestOffset, length: manifestLen }], pad);
    if (m.length === manifestLen) { layout = l; placeholder = m; }
    else manifestLen = m.length;
  }
  if (!placeholder) throw new Error('C2PA embed: manifest layout did not converge');

  const out = concatBytes([pdfBytes, binToBytes(layout.head), placeholder, binToBytes(layout.tail)]);
  const exclusions = [{ start: layout.manifestOffset, length: manifestLen }];
  // Hard binding: sha256 of the final file with the manifest bytes OMITTED
  // (C2PA exclusions skip the range from the hash input; nothing is zeroed).
  const digest = await sha256(concatBytes([
    out.subarray(0, layout.manifestOffset),
    out.subarray(layout.manifestOffset + manifestLen),
  ]));

  // Pass 2: same layout, real hash. Only fixed-width fields changed, so the
  // length must match; `pad` absorbs any residual drift as a safety net.
  let manifest = await build(digest, exclusions, pad);
  if (manifest.length !== manifestLen) {
    const padLen = pad.length + (manifestLen - manifest.length);
    if (padLen < 0 || padLen >= 24) throw new Error('C2PA embed: manifest length drifted beyond pad range');
    manifest = await build(digest, exclusions, new Uint8Array(padLen));
    if (manifest.length !== manifestLen) throw new Error('C2PA embed: manifest length is not deterministic');
  }
  out.set(manifest, layout.manifestOffset);

  // The incremental-update contract: original bytes are a byte-identical prefix.
  for (let i = 0; i < pdfBytes.length; i++) {
    if (out[i] !== pdfBytes[i]) throw new Error('C2PA embed: original PDF bytes were modified');
  }
  return out;
}
