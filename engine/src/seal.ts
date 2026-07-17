// SPDX-License-Identifier: MPL-2.0
/**
 * SEAL (hackerfactor.com) signature verifier — pure, DOM-free (globalThis.crypto
 * only, like c2pa-verify.ts / x509.ts). VERIFICATION ONLY: this reads a SEAL
 * record out of a file's raw bytes, reassembles exactly the byte ranges the
 * record says were signed, and checks the signature against a public key.
 *
 * SEAL is a DISTINCT format from Meta's "Content Seal" (Pixel Seal / Video Seal,
 * a neural pixel watermark — see contentseal.ts). SEAL is a cryptographic
 * signature over the FILE BYTES: the signer embeds a tiny XML-like record in the
 * file and publishes the matching public key in DNS. A valid SEAL proves the
 * covered bytes are unmodified since signing AND that the signer controlled DNS
 * for the record's domain — domain-level attribution + integrity, NOT a
 * CA-verified legal identity, and NOT a statement about the visual content.
 *
 * Ethos: on-device verify. The image never leaves the device — the ONLY thing
 * that can leave is a public-key DNS lookup for the record's domain, and even
 * that is the caller's concern: this module takes an INJECTED `resolveKey`
 * (DNS-over-HTTPS lives in the shell, host.net-allowlisted) so the engine stays
 * network-free, exactly like c2pa-verify.ts does WebCrypto but never fetch. The
 * record's inline `pk=` public key, when present, is a fully-offline path.
 *
 * Spec: https://github.com/hackerfactor/SEAL (SPECIFICATION.md, FORMATS.md);
 * parser recipe cross-checked against SEAL-js (src/seal.ts, src/crypto.ts).
 *
 * SCOPE / honesty (see the module tests and the caller's UI copy):
 *   - Algorithms: `ka=rsa` (RSASSA-PKCS1-v1_5) and `ka=ec` (ECDSA P-256/384/521)
 *     — the two the SEAL spec defines. (SEAL has NO Ed25519 `ka`; the crypto
 *     round-trip test therefore exercises ECDSA + RSA, real signatures from
 *     WebCrypto, not a mock.)
 *   - Digest: sha256 (default) / sha384 / sha512. `da=sha224` is refused —
 *     WebCrypto's SubtleCrypto has no SHA-224.
 *   - Byte ranges: the default `F~S,s~f` and simple marker+offset forms
 *     (`s+4~f`, `F+n~S`, …). Multi-signature append chains (`P`/`p` markers) and
 *     external-file digests (`srcd`/`ext*`) are parsed-but-not-verified in v1.
 *   - The crypto round-trip is unit-tested against standard-crypto signatures.
 *     Behaviour against Krawetz's REAL published sample files and against LIVE
 *     DNS is UNVERIFIED here (no samples / no network in the test env).
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// TS 5.7+ widens Uint8Array to Uint8Array<ArrayBufferLike>; WebCrypto wants an
// ArrayBuffer-backed BufferSource. Every buffer here is ArrayBuffer-backed, so
// this is a type-only widening, erased at runtime (matches c2pa-verify.ts).
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Byte-transparent binary string (each char == one byte; TextDecoder('latin1')
// would remap 0x80–0x9f, so we build it by hand). Used so record offsets found
// in the string map 1:1 onto file byte offsets.
function bytesToBin(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return s;
}

// ─── encodings ─────────────────────────────────────────────────────────────

// Standard base64, tolerant of missing `=` padding (SEAL/DNS both omit it) and
// of embedded whitespace. Throws on genuinely invalid input (caller guards).
function base64ToBytes(input: string): Uint8Array {
  let s = input.replace(/\s+/g, '');
  const pad = s.length % 4;
  if (pad === 1) throw new Error('seal: bad base64 length');
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(input: string): Uint8Array {
  const s = input.replace(/\s+/g, '');
  if (s.length % 2) throw new Error('seal: odd-length hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = Number.parseInt(s.substr(i * 2, 2), 16);
    if (Number.isNaN(b)) throw new Error('seal: bad hex digit');
    out[i] = b;
  }
  return out;
}

// A latin1 value string (from a raw record) → the exact bytes it stands for.
function binStringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ─── record types ──────────────────────────────────────────────────────────

export interface SealRange { start: number; stop: number; }

/** A single parsed SEAL record. All byte offsets are absolute file offsets. */
export interface SealRecord {
  /** `seal=` format version (currently 1). */
  version: number;
  /** `d=` — the domain whose DNS TXT record holds the public key. */
  domain: string;
  /** `ka=` — key/signature algorithm. */
  keyAlg: 'rsa' | 'ec';
  /** `da=` mapped to a WebCrypto digest name ('SHA-256'|'SHA-384'|'SHA-512'),
   *  or null when the digest is unsupported here (e.g. sha224). */
  digestAlg: string | null;
  /** The raw `da=` token as it appeared ('sha256', 'sha224', …). */
  digestAlgRaw: string;
  /** `sf=` encoding of the signature value, date prefix stripped
   *  ('base64'|'hex'|'HEX'|'bin'). */
  sigFormat: string;
  /** The date scheme from `sf=` ('date'|'date0'|'dateN'…) or null. */
  dateScheme: string | null;
  /** Decoded signature bytes (DER ECDSA-Sig-Value for `ka=ec`), or null when
   *  the value could not be decoded (parse never throws). */
  signature: Uint8Array | null;
  /** Timestamp lifted from the `s=` value prefix (date sf only), else null. */
  timestamp: string | null;
  /** `b=` resolved to concrete [start,stop) file ranges, or null when the byte
   *  range could not be resolved (e.g. references a previous signature). */
  ranges: SealRange[] | null;
  /** The raw `b=` spec string (default 'F~S,s~f'). */
  byteRangeSpec: string;
  /** `uid=` (default ''). */
  uid: string;
  /** `kv=` key version (default '1'). */
  keyVersion: string;
  /** `id=` signer identity mixed into the double-digest, else null. */
  id: string | null;
  /** `pk=` inline public key (SPKI DER) for offline verification, else null. */
  inlineKey: Uint8Array | null;
  /** Absolute file offset of the record's first byte (the `<`). */
  recordStart: number;
  /** Absolute file offset just past the record's terminator. */
  recordEnd: number;
  /** `S` — absolute file offset of the first byte INSIDE the `s="…"` value. */
  sigValueStart: number;
  /** `s` — absolute file offset of the `s="…"` value's closing delimiter. */
  sigValueEnd: number;
  /** Set when the record was located and had the required fields but something
   *  downstream (signature decode, byte-range resolve) failed — surfaced as the
   *  verify reason rather than thrown. */
  parseError?: string;
}

const DIGEST_MAP: Record<string, string | null> = {
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
  sha224: null, // allowed by the spec, but WebCrypto SubtleCrypto has no SHA-224
};

// Start markers (byte patterns) and their wrapper shapes. `<seal ` / `<?seal `
// are the file/PI forms; `&lt;seal ` is the entity-encoded XMP/HTML form. We
// also tolerate the fused `<seal=`/`<?seal=` tag head the spec's rendered
// examples show (see the format's own gaps note) by scanning for `<seal`/`<?seal`
// and accepting a following space OR `=`.
const START_NEEDLES = ['<?seal', '<seal', '&lt;seal'];
const TERMINATORS = ['/>', '?>', '/&gt;'];

// Only scan the first and last 64 KB of files larger than 128 KB (SEAL-js does
// the same): the record lives near a container boundary, never buried in pixels.
const SCAN_EDGE = 64 * 1024;
const SCAN_WHOLE_MAX = 128 * 1024;

// Locate every candidate record's [start, end) byte span in `bin` (a
// byte-transparent string of the whole file). `end` is just past the terminator.
function locateRecords(bin: string, length: number): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const windows: Array<[number, number]> = length > SCAN_WHOLE_MAX
    ? [[0, SCAN_EDGE], [length - SCAN_EDGE, length]]
    : [[0, length]];
  const seen = new Set<number>();
  for (const [wStart, wEnd] of windows) {
    for (const needle of START_NEEDLES) {
      let from = wStart;
      for (;;) {
        const at = bin.indexOf(needle, from);
        if (at < 0 || at >= wEnd) break;
        from = at + 1;
        // The char right after the needle's `seal` must be a space or `=`
        // (attribute form) — reject `<sealed>` and similar false hits.
        const after = bin[at + needle.length];
        if (after !== ' ' && after !== '=' && after !== ':') continue;
        if (seen.has(at)) continue;
        // Find the nearest terminator after the start (but before the next `<`,
        // so a start with no terminator can't swallow the rest of the file).
        let end = -1;
        const nextTag = bin.indexOf('<', at + needle.length);
        const limit = Math.min(at + 64 * 1024, length);
        for (const term of TERMINATORS) {
          const t = bin.indexOf(term, at + needle.length);
          if (t < 0 || t >= limit) continue;
          // A `<` before the terminator means this start never closed.
          if (nextTag >= 0 && nextTag < t && !needle.startsWith('&')) continue;
          const e = t + term.length;
          if (end < 0 || e < end) end = e;
        }
        if (end < 0) continue;
        seen.add(at);
        spans.push({ start: at, end });
      }
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

// Entity-decode the XMP/HTML embedding of attribute VALUES (never touches
// offsets — those are computed from the raw record before decoding).
function entityDecode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Pull `key="value"` (and DNS-tolerant `key=token`) pairs out of the record's
// interior. The caller has already entity-decoded `interior`, so quoted values
// use literal `"`. Order preserved.
function extractPairs(interior: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const re = /([A-Za-z][A-Za-z0-9._+-]*)\s*=\s*(?:"([^"]*)"|([^\s"]+))/g;
  for (let m: RegExpExecArray | null; (m = re.exec(interior)); ) {
    const key = m[1]!;
    const val = m[2] !== undefined ? m[2] : (m[3] ?? '');
    pairs.push([key, val]);
  }
  return pairs;
}

// Within a raw record string, find the `s=` (signature) attribute value's
// delimiters. The signature MUST be the last attribute, and base64/hex/date
// values never contain a `"`, so the last quoted region before the terminator
// is the signature value. Returns [valueStart, valueEnd) as offsets INTO `rec`
// (the record slice), or null when it can't be located unambiguously.
function findSigValueSpan(rec: string): { valStart: number; valEnd: number } | null {
  // Strip a trailing terminator so the closing quote we seek is the value's.
  let end = rec.length;
  for (const term of TERMINATORS) {
    if (rec.endsWith(term)) { end = rec.length - term.length; break; }
  }
  // Walk back over trailing whitespace.
  while (end > 0 && (rec[end - 1] === ' ' || rec[end - 1] === '\t')) end--;
  // Literal-quote form: … s="VALUE"  (VALUE has no ").
  if (rec[end - 1] === '"') {
    const valEnd = end - 1;
    const valStart = rec.lastIndexOf('"', valEnd - 1) + 1;
    if (valStart <= 0) return null;
    if (!/(?:^|\s)s\s*=\s*$/.test(rec.slice(0, valStart - 1))) {
      // The char before the opening quote must complete `s=` (last attribute).
      // Be lenient: also accept `s =` / trailing spaces handled by the regex.
      // Fall through to the &quot; check only if this fails.
    } else {
      return { valStart, valEnd };
    }
    // Even if the strict s= check didn't match (odd spacing), the last quoted
    // region is still the value by the "s must be last" invariant.
    return { valStart, valEnd };
  }
  // Entity-quoted form: … s=&quot;VALUE&quot;
  if (rec.slice(end - 6, end) === '&quot;') {
    const valEnd = end - 6;
    const open = rec.lastIndexOf('&quot;', valEnd - 1);
    if (open < 0) return null;
    return { valStart: open + 6, valEnd };
  }
  return null;
}

/**
 * Parse every SEAL record embedded in a file's raw bytes. Bounds-checked and
 * NEVER throws — a malformed or hostile file yields [] (or records carrying a
 * `parseError` when they were located but couldn't be fully resolved). A record
 * missing any of the required fields (`seal`,`d`,`ka`,`s`) is skipped.
 */
export function parseSealRecords(bytes: Uint8Array): SealRecord[] {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8) return [];
  let bin: string;
  try { bin = bytesToBin(bytes); } catch { return []; }
  const out: SealRecord[] = [];
  let spans: Array<{ start: number; end: number }>;
  try { spans = locateRecords(bin, bytes.length); } catch { return []; }

  // Track previous signature-value spans so `P`/`p` markers in append chains at
  // least resolve to a definite offset (verification of chains is out of v1
  // scope, but the offsets are needed to not mis-hash a later record).
  let prevSigStart = -1;
  let prevSigEnd = -1;

  for (const span of spans) {
    try {
      const rec = bin.slice(span.start, span.end);
      const sigSpan = findSigValueSpan(rec);
      if (!sigSpan) continue; // no locatable signature value — not a usable record

      // Strip wrapper + terminator to get the attribute interior for parsing.
      let interior = rec;
      for (const needle of START_NEEDLES) {
        if (interior.startsWith(needle)) { interior = interior.slice(needle.length); break; }
      }
      // Fused tag head `<seal="1" …>` (some rendered spec examples): the version
      // rode into the element name. Re-materialise it as a `seal=` attribute so
      // the required-field check and extractPairs see it (spec gaps note #1).
      if (interior.startsWith('=')) interior = 'seal' + interior;
      for (const term of TERMINATORS) {
        if (interior.endsWith(term)) { interior = interior.slice(0, interior.length - term.length); break; }
      }
      // Entity-decode the interior (XMP/HTML encode `"` as &quot;) BEFORE pulling
      // pairs, so quoted values are recognised. Offsets were already taken from
      // the RAW record above, so this never affects S/s.
      const pairs = extractPairs(entityDecode(interior));
      const get = (k: string): string | undefined => {
        for (const [key, val] of pairs) if (key === k) return val;
        return undefined;
      };

      // Required fields. `seal` may appear fused with the tag head; extractPairs
      // still finds it because we scan the interior after `<seal`/`<?seal`.
      const sealVer = get('seal');
      const domain = get('d');
      const kaRaw = get('ka');
      const sRaw = get('s');
      if (sealVer === undefined || !domain || !kaRaw || sRaw === undefined) continue;
      if (kaRaw !== 'rsa' && kaRaw !== 'ec') {
        out.push(makeStub(span, sigSpan, sealVer, domain, kaRaw, get, `unsupported key algorithm '${kaRaw}' (SEAL defines rsa and ec)`));
        continue;
      }

      const digestAlgRaw = (get('da') || 'sha256').toLowerCase();
      const digestAlg = digestAlgRaw in DIGEST_MAP ? DIGEST_MAP[digestAlgRaw]! : undefined;
      const uid = get('uid') ?? '';
      const keyVersion = get('kv') ?? '1';
      const id = get('id') ?? null;

      // sf: an optional date prefix (date/date0/dateN) then the encoding.
      const sfRaw = (get('sf') || 'base64');
      const dateMatch = /^(date[0-9]*)[:]?(.*)$/.exec(sfRaw);
      const dateScheme = dateMatch && /^date/.test(sfRaw) && dateMatch[1] !== undefined && dateMatch[2] !== undefined
        ? dateMatch[1] : null;
      const sigFormat = dateScheme ? (dateMatch![2] || 'base64') : sfRaw;

      const sigValueStart = span.start + sigSpan.valStart;
      const sigValueEnd = span.start + sigSpan.valEnd;

      // The signature value AS BYTES from the file (offset-exact, pre-decode).
      // NB: sigValueStart/End are ABSOLUTE file offsets, not record-relative.
      const rawValue = bin.slice(sigValueStart, sigValueEnd);

      // Split off a leading TIMESTAMP: prefix for date sf, then decode the rest.
      let timestamp: string | null = null;
      let encoded = rawValue;
      if (dateScheme) {
        const colon = rawValue.indexOf(':');
        if (colon >= 0) { timestamp = rawValue.slice(0, colon); encoded = rawValue.slice(colon + 1); }
      }

      let signature: Uint8Array | null = null;
      let parseError: string | undefined;
      try {
        signature = decodeSignature(encoded, sigFormat);
      } catch (e) {
        parseError = `signature value could not be decoded (${(e as Error).message})`;
      }

      // Resolve byte ranges against the marker context for THIS record.
      const ctx: Record<string, number> = {
        F: 0, f: bytes.length,
        S: sigValueStart, s: sigValueEnd,
        P: prevSigStart, p: prevSigEnd,
      };
      const byteRangeSpec = get('b') || 'F~S,s~f';
      let ranges: SealRange[] | null = null;
      try {
        ranges = resolveRanges(byteRangeSpec, ctx);
      } catch (e) {
        if (!parseError) parseError = `byte range could not be resolved (${(e as Error).message})`;
      }

      let inlineKey: Uint8Array | null = null;
      const pk = get('pk');
      if (pk) { try { inlineKey = base64ToBytes(pk); } catch { /* ignore bad inline key */ } }

      out.push({
        version: Number.parseInt(sealVer, 10) || 1,
        domain,
        keyAlg: kaRaw,
        digestAlg: digestAlg === undefined ? null : digestAlg,
        digestAlgRaw,
        sigFormat,
        dateScheme,
        signature,
        timestamp,
        ranges,
        byteRangeSpec,
        uid,
        keyVersion,
        id,
        inlineKey,
        recordStart: span.start,
        recordEnd: span.end,
        sigValueStart,
        sigValueEnd,
        parseError,
      });

      prevSigStart = sigValueStart;
      prevSigEnd = sigValueEnd;
    } catch { /* a single malformed record never aborts the scan */ }
  }
  return out;
}

function makeStub(
  span: { start: number; end: number },
  sigSpan: { valStart: number; valEnd: number },
  sealVer: string,
  domain: string,
  ka: string,
  get: (k: string) => string | undefined,
  parseError: string,
): SealRecord {
  return {
    version: Number.parseInt(sealVer, 10) || 1,
    domain,
    keyAlg: (ka === 'rsa' || ka === 'ec') ? ka : 'ec',
    digestAlg: null,
    digestAlgRaw: (get('da') || 'sha256').toLowerCase(),
    sigFormat: get('sf') || 'base64',
    dateScheme: null,
    signature: null,
    timestamp: null,
    ranges: null,
    byteRangeSpec: get('b') || 'F~S,s~f',
    uid: get('uid') ?? '',
    keyVersion: get('kv') ?? '1',
    id: get('id') ?? null,
    inlineKey: null,
    recordStart: span.start,
    recordEnd: span.end,
    sigValueStart: span.start + sigSpan.valStart,
    sigValueEnd: span.start + sigSpan.valEnd,
    parseError,
  };
}

/** Back-compat / convenience: the first parsed record, or null. */
export function parseSealRecord(bytes: Uint8Array): SealRecord | null {
  const all = parseSealRecords(bytes);
  return all.length ? all[0]! : null;
}

// Decode one signature value per `sf` (date prefix already removed by caller).
function decodeSignature(value: string, sf: string): Uint8Array {
  switch (sf) {
    case 'hex':
    case 'HEX': return hexToBytes(value);
    case 'bin': return binStringToBytes(value);
    default: return base64ToBytes(value); // 'base64' (the default)
  }
}

// ─── byte ranges ─────────────────────────────────────────────────────────────

// One token → an absolute offset. Grammar: [marker][(+|-)int] | bare-int | ''.
function resolveToken(tok: string, ctx: Record<string, number>, isStart: boolean, len: number): number {
  const t = tok.trim();
  if (t === '') return isStart ? 0 : len;
  const m = /^([FfSsPp])?\s*([+-]\s*\d+)?$/.exec(t);
  if (m && (m[1] || m[2])) {
    let base = 0;
    if (m[1]) {
      const v = ctx[m[1]];
      if (v === undefined || v < 0) throw new Error(`unresolved marker '${m[1]}'`);
      base = v;
    }
    if (m[2]) base += Number.parseInt(m[2].replace(/\s+/g, ''), 10);
    return base;
  }
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  throw new Error(`bad range token '${tok}'`);
}

/** Resolve a `b=` spec (`start~stop,start~stop,…`) to concrete file ranges.
 *  Throws on unresolved markers or out-of-bounds / non-monotonic ranges. */
export function resolveRanges(spec: string, ctx: Record<string, number>): SealRange[] {
  const len = ctx.f ?? 0;
  const ranges: SealRange[] = [];
  const parts = spec.split(',');
  if (!parts.length) throw new Error('empty byte range');
  for (const part of parts) {
    const tilde = part.indexOf('~');
    if (tilde < 0) throw new Error(`range '${part}' has no '~'`);
    const start = resolveToken(part.slice(0, tilde), ctx, true, len);
    const stop = resolveToken(part.slice(tilde + 1), ctx, false, len);
    if (!Number.isFinite(start) || !Number.isFinite(stop)) throw new Error('non-numeric range');
    if (start < 0 || stop > len || stop < start) throw new Error(`range ${start}~${stop} out of bounds (0..${len})`);
    ranges.push({ start, stop });
  }
  return ranges;
}

/** Assemble the exact bytes the digest/signature operate on, by concatenating
 *  each range in order (SEAL-js MediaAsset.assembleBuffer). */
export function assembleSealMessage(bytes: Uint8Array, ranges: SealRange[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const r of ranges) {
    if (r.start < 0 || r.stop > bytes.length || r.stop < r.start) throw new Error('seal: range out of bounds');
    parts.push(bytes.subarray(r.start, r.stop));
  }
  return concatBytes(parts);
}

/** SHA-{256,384,512} of exactly the covered byte ranges (the message with the
 *  signature value excluded). `digestAlg` is a WebCrypto name. */
export async function computeSealDigest(bytes: Uint8Array, ranges: SealRange[], digestAlg: string): Promise<Uint8Array> {
  const msg = assembleSealMessage(bytes, ranges);
  return new Uint8Array(await subtle.digest(digestAlg, asBufferSource(msg)));
}

// Does the range set protect essentially the WHOLE file — i.e. it reaches byte
// 0 and EOF with exactly one gap, and that gap begins at the signature value
// (default `F~S,s~f`, or `F~S,s+4~f` where a trailing checksum is also skipped)?
function coversWholeFile(ranges: SealRange[], sigStart: number, len: number): boolean {
  if (!ranges.length) return false;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  if (sorted[0]!.start !== 0) return false;
  let pos = 0;
  let gaps = 0;
  let gapAtSig = false;
  for (const r of sorted) {
    if (r.start > pos) { gaps++; if (pos === sigStart) gapAtSig = true; }
    else if (r.start < pos) return false; // overlap
    pos = Math.max(pos, r.stop);
  }
  return pos === len && gaps === 1 && gapAtSig;
}

// ─── key import + signature verify ───────────────────────────────────────────

// ECDSA SPKI byte lengths → curve (SEAL-js detects the curve this way). We also
// parse the curve OID as the authoritative fallback below.
const EC_SPKI_LEN: Record<number, { curve: string; size: number }> = {
  91: { curve: 'P-256', size: 32 },
  120: { curve: 'P-384', size: 48 },
  156: { curve: 'P-521', size: 66 },
};
// EC named-curve OIDs (hex of the OID content) → curve params.
const EC_CURVE_OIDS: Record<string, { curve: string; size: number }> = {
  '2a8648ce3d030107': { curve: 'P-256', size: 32 }, // prime256v1
  '2b81040022': { curve: 'P-384', size: 48 },       // secp384r1
  '2b81040023': { curve: 'P-521', size: 66 },       // secp521r1
};

// Read the named curve out of an EC SPKI's AlgorithmIdentifier (best-effort;
// falls back to the byte-length heuristic). Minimal, bounds-checked DER walk.
function ecCurveOf(spki: Uint8Array): { curve: string; size: number } | null {
  try {
    // SEQUENCE { AlgorithmIdentifier SEQUENCE { ecPublicKey OID, curve OID }, BIT STRING }
    if (spki[0] !== 0x30) return EC_SPKI_LEN[spki.length] ?? null;
    let i = 2;
    if (spki[1]! & 0x80) i = 2 + (spki[1]! & 0x7f);
    if (spki[i] !== 0x30) return EC_SPKI_LEN[spki.length] ?? null;
    const algLen = spki[i + 1]!;
    let j = i + 2;
    const algEnd = j + algLen;
    // Skip the first OID (ecPublicKey), then read the curve OID.
    while (j < algEnd && j + 1 < spki.length) {
      const tag = spki[j]!;
      const len = spki[j + 1]!;
      if (tag === 0x06) {
        const hex = Array.from(spki.subarray(j + 2, j + 2 + len), (b) => b.toString(16).padStart(2, '0')).join('');
        const byOid = EC_CURVE_OIDS[hex];
        if (byOid) return byOid;
      }
      j += 2 + len;
    }
    return EC_SPKI_LEN[spki.length] ?? null;
  } catch {
    return EC_SPKI_LEN[spki.length] ?? null;
  }
}

/** Import a SEAL public key (SPKI DER) for verification. Throws when the key is
 *  malformed or the curve is unsupported by WebCrypto. */
export async function importSealKey(spki: Uint8Array, keyAlg: 'rsa' | 'ec', digestAlg: string): Promise<CryptoKey> {
  if (keyAlg === 'rsa') {
    return subtle.importKey('spki', asBufferSource(spki), { name: 'RSASSA-PKCS1-v1_5', hash: digestAlg }, false, ['verify']);
  }
  const ec = ecCurveOf(spki);
  if (!ec) throw new Error('seal: unrecognised EC curve (only P-256/384/521 are supported)');
  return subtle.importKey('spki', asBufferSource(spki), { name: 'ECDSA', namedCurve: ec.curve }, false, ['verify']);
}

// DER ECDSA-Sig-Value (SEQUENCE { INTEGER r, INTEGER s }) → fixed-width raw
// r||s (IEEE P1363), which is what WebCrypto ECDSA verify accepts. Strips each
// INTEGER's leading sign pad, left-pads back to the curve field width.
function ecdsaDerToRaw(der: Uint8Array, size: number): Uint8Array {
  if (der[0] !== 0x30) throw new Error('seal: ECDSA signature is not DER');
  let i = 2;
  if (der[1]! & 0x80) i = 2 + (der[1]! & 0x7f);
  const readInt = (): Uint8Array => {
    if (der[i] !== 0x02) throw new Error('seal: ECDSA integer expected');
    const len = der[i + 1]!;
    let start = i + 2;
    const end = start + len;
    if (end > der.length) throw new Error('seal: ECDSA integer overruns');
    while (start < end && der[start] === 0) start++; // drop sign pad
    i = end;
    return der.subarray(start, end);
  };
  const r = readInt();
  const s = readInt();
  if (r.length > size || s.length > size) throw new Error('seal: ECDSA integer wider than the curve');
  const out = new Uint8Array(size * 2);
  out.set(r, size - r.length);
  out.set(s, size * 2 - s.length);
  return out;
}

/**
 * Verify a SEAL signature. `message` is the exact pre-image WebCrypto hashes
 * with `digestAlg` — the assembled byte ranges in the basic case, or
 * utf8(prepend)||digest1 in the id/date "double-digest" case (the caller builds
 * that; see verifySeal). `signature` is the decoded value (DER for `ka=ec`).
 *
 * NOTE: WebCrypto hashes `message` internally, so callers pass the MESSAGE, not
 * a precomputed hash — the single most load-bearing correctness point of SEAL.
 * Returns false (never throws) on any import/convert/verify failure.
 */
export async function verifySealSignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: CryptoKey,
  keyAlg: 'rsa' | 'ec',
  digestAlg: string,
): Promise<boolean> {
  try {
    if (keyAlg === 'rsa') {
      return await subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, publicKey, asBufferSource(signature), asBufferSource(message));
    }
    const named = (publicKey.algorithm as EcKeyAlgorithm).namedCurve;
    const size = named === 'P-384' ? 48 : named === 'P-521' ? 66 : 32;
    // SEAL EC signatures are ASN.1/DER; convert to raw r||s for WebCrypto.
    let raw = signature;
    if (signature[0] === 0x30) { try { raw = ecdsaDerToRaw(signature, size); } catch { /* maybe already raw */ } }
    return await subtle.verify({ name: 'ECDSA', hash: digestAlg }, publicKey, asBufferSource(raw), asBufferSource(message));
  } catch {
    return false;
  }
}

// ─── top-level verify ─────────────────────────────────────────────────────────

/** Resolve a record's DNS public key (SPKI DER) — INJECTED by the shell so the
 *  engine stays network-free. Return null when no key is available/selected
 *  (e.g. a revoked selector), which surfaces as an honest "unverified" result. */
export type SealPublicKeyResolver = (record: SealRecord) => Promise<Uint8Array | null> | Uint8Array | null;

export interface SealVerifyResult {
  /** A SEAL record was located in the file. */
  found: boolean;
  /** The signature cryptographically verified against the resolved key. */
  valid: boolean;
  /** `d=` — the domain the record attributes the signature to. */
  domain: string | null;
  /** The signature protects the whole file (only the signature value is excluded). */
  coversWholeFile: boolean;
  keyAlg: 'rsa' | 'ec' | null;
  /** WebCrypto digest name actually used, or null. */
  digestAlg: string | null;
  /** Timestamp from a date-format signature, else null. */
  timestamp: string | null;
  uid: string | null;
  /** `id=` signer identity string, else null. */
  signerId: string | null;
  /** Where the verifying key came from: DNS (`resolveKey`) or the inline `pk=`. */
  keySource: 'dns' | 'inline' | null;
  /** How many SEAL records were found in the file. */
  recordCount: number;
  /** Human-readable status / failure reason. */
  reason: string;
}

const NONE: SealVerifyResult = {
  found: false, valid: false, domain: null, coversWholeFile: false,
  keyAlg: null, digestAlg: null, timestamp: null, uid: null, signerId: null,
  keySource: null, recordCount: 0, reason: 'no SEAL record found',
};

/**
 * Verify a file's SEAL signature entirely on-device. Parses the record(s) from
 * raw bytes (no network); only if a record is found AND has no usable inline
 * key does it call the injected `resolveKey` (the DNS/DoH lookup — the sole
 * thing that ever leaves the device, and never the file itself).
 *
 * v1 verifies a single embedded RSA/ECDSA signature over the default/simple
 * byte ranges. Multiple records are each attempted; the first VALID one wins,
 * else the first found record's failure reason is reported.
 */
export async function verifySeal(bytes: Uint8Array, resolveKey?: SealPublicKeyResolver): Promise<SealVerifyResult> {
  if (!(bytes instanceof Uint8Array)) return { ...NONE };
  const records = parseSealRecords(bytes);
  if (!records.length) return { ...NONE };

  let firstResult: SealVerifyResult | null = null;
  for (const rec of records) {
    const result = await verifyOneRecord(bytes, rec, records.length, resolveKey);
    if (result.valid) return result;
    if (!firstResult) firstResult = result;
  }
  return firstResult ?? { ...NONE, found: true, recordCount: records.length, reason: 'SEAL record found but could not be verified' };
}

async function verifyOneRecord(
  bytes: Uint8Array,
  rec: SealRecord,
  recordCount: number,
  resolveKey?: SealPublicKeyResolver,
): Promise<SealVerifyResult> {
  const base: SealVerifyResult = {
    found: true, valid: false, domain: rec.domain, coversWholeFile: false,
    keyAlg: rec.keyAlg, digestAlg: rec.digestAlg, timestamp: rec.timestamp,
    uid: rec.uid, signerId: rec.id, keySource: null, recordCount,
    reason: 'unverified',
  };

  if (rec.parseError) return { ...base, reason: rec.parseError };
  if (!rec.digestAlg) return { ...base, reason: `unsupported digest '${rec.digestAlgRaw}' (WebCrypto has no SHA-224)` };
  if (!rec.signature) return { ...base, reason: 'signature value could not be decoded' };
  if (!rec.ranges) return { ...base, reason: 'signed byte range could not be resolved' };

  base.coversWholeFile = coversWholeFile(rec.ranges, rec.sigValueStart, bytes.length);

  // Obtain the public key: DNS (attribution) first when a resolver is supplied,
  // else the offline inline pk=.
  let spki: Uint8Array | null = null;
  let keySource: 'dns' | 'inline' | null = null;
  if (resolveKey) {
    try {
      const resolved = await resolveKey(rec);
      if (resolved instanceof Uint8Array && resolved.length) { spki = resolved; keySource = 'dns'; }
    } catch (e) {
      return { ...base, reason: `could not resolve the signing key for ${rec.domain} (${(e as Error).message})` };
    }
  }
  if (!spki && rec.inlineKey) { spki = rec.inlineKey; keySource = 'inline'; }
  if (!spki) {
    return { ...base, reason: resolveKey ? `no public key published for ${rec.domain}` : 'no key resolver and no inline key' };
  }

  let key: CryptoKey;
  try {
    key = await importSealKey(spki, rec.keyAlg, rec.digestAlg);
  } catch (e) {
    return { ...base, keySource, reason: `could not import the ${rec.keyAlg.toUpperCase()} public key (${(e as Error).message})` };
  }

  // Build the message WebCrypto will hash: raw ranges (basic) or
  // utf8(DATE:ID:) || digest1 (extended double-digest).
  let message: Uint8Array;
  try {
    const rangeMsg = assembleSealMessage(bytes, rec.ranges);
    if (rec.id || rec.timestamp) {
      const digest1 = new Uint8Array(await subtle.digest(rec.digestAlg, asBufferSource(rangeMsg)));
      let prepend = '';
      if (rec.timestamp) prepend += rec.timestamp + ':';
      if (rec.id) prepend += rec.id + ':';
      message = concatBytes([te.encode(prepend), digest1]);
    } else {
      message = rangeMsg;
    }
  } catch (e) {
    return { ...base, keySource, reason: `could not assemble the signed bytes (${(e as Error).message})` };
  }

  const valid = await verifySealSignature(message, rec.signature, key, rec.keyAlg, rec.digestAlg);
  return {
    ...base,
    keySource,
    valid,
    reason: valid
      ? `signature valid — attributed to ${rec.domain}${base.coversWholeFile ? ', covers the whole file' : ', covers a partial byte range'}${keySource === 'inline' ? ' (verified with the record’s inline key)' : ''}`
      : 'signature did not verify (the covered bytes were modified, or the key does not match)',
  };
}
