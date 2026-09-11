// SPDX-License-Identifier: MPL-2.0
/**
 * sdp-codec - the invite/accept payload of a private collab (plan 100 section 6.1, wave 2.1).
 *
 * THE PROBLEM. Non-trickle ICE makes the whole signaling channel exactly two
 * payloads, and the humans are the channel: A shows an invite, B shows an answer.
 * A real Chrome data-channel offer is ~2.5 KB of SDP against a ~2,953-byte absolute
 * QR ceiling and a ~100-byte *practical* scanning budget (section 2.9) - so the SDP itself
 * cannot be the payload. Almost none of it varies: the m-line, the transport, the
 * SCTP port and the session boilerplate are identical on every browser and are
 * reconstructed from a template here. What actually varies is five things:
 *
 *   the DTLS fingerprint · the ICE ufrag · the ICE pwd · the candidates · setup role
 *
 * That is the `SdpMaterial` this module extracts from a real SDP, packs into a
 * compact binary record with the invite metadata, dresses in a text skin, and
 * reconstructs on the far side into a valid SDP for `setRemoteDescription`.
 *
 * THE FINGERPRINT IS THE TRUST ROOT (section 6.1). Because it rides inside the invite, the
 * channel the humans used to exchange the blob *is* the authentication: a hostile
 * intermediary can drop the pairing but cannot MITM it. Two consequences enforced
 * here rather than documented and hoped for: only SHA-256/384/512 fingerprints are
 * accepted (a SHA-1 downgrade would weaken the one thing carrying the trust), and
 * every field that lands in reconstructed SDP text is charset-validated, so no
 * decoded payload can inject an SDP line (a `\r\n` inside an ufrag would otherwise
 * let a hostile invite append `a=` attributes of its own choosing).
 *
 * DEFENSIVE BY CONTRACT (section 11.21). This payload arrives from a stranger's QR code or
 * a pasted link - it is untrusted input, exactly like a shared URL. Every public
 * function returns `CodecResult<T>` and NEVER throws: length caps before decode, a
 * version byte, exact-consumption parsing (trailing bytes are an error, not slack),
 * canonical-form checks on the text skins, and a whitelist charset on `toolId`
 * (which the ceremony then uses to look up a local tool).
 *
 * ── The binary record ──────────────────────────────────────────────────────────
 *
 *   byte 0   version (= SDP_CODEC_VERSION)
 *   byte 1   header
 *              bits 0-1  kind        0 = answer, 1 = invite
 *              bits 2-3  setup role  0 = actpass, 1 = active, 2 = passive
 *              bits 4-5  fp algo     0 = sha-256, 1 = sha-384, 2 = sha-512
 *              bit  6    opVersion present (invite only; costs 0 bytes when absent)
 *              bit  7    reserved (must be 0 - a later shape bumps the version byte)
 *   ...      fingerprint bytes: 32 / 48 / 64, implied by the algo
 *   ...      ice-ufrag: u8 char count (1..127) + ceil(n*6/8) bytes, 6 bits per char
 *   ...      ice-pwd:   same
 *   ...      u8 candidate count (0..MAX_CANDIDATES)
 *     per candidate:
 *   ...        u8 flags
 *                bits 0-1  address  0 = IPv4 (4 B), 1 = IPv6 (16 B),
 *                                   2 = mDNS uuid (16 B), 3 = text (u8 len + UTF-8)
 *                bit 2     protocol 0 = udp, 1 = tcp
 *                bit 3     type     0 = host, 1 = srflx
 *                bit 4     priority present (u32 BE, after the port)
 *                bit 5     tcptype  0 = passive, 1 = active (read only when tcp)
 *                bits 6-7  reserved (must be 0)
 *   ...        address payload · u16 BE port · [u32 BE priority]
 *     if kind = invite:
 *   ...      toolId        u8 len + UTF-8
 *   ...      toolVersion   version field (below)
 *   ...      engineVersion version field
 *   ...      name          u8 len + UTF-8 (0 = absent)
 *   ...      u8 colorIndex (255 = absent)
 *   ...      opVersion     version field, present iff header bit 6
 *
 *   version field: u8 lead. `0x80` exactly → a compact `major.minor.patch` as three
 *   u8s (so "1.108.0" costs 4 bytes, not 8); otherwise the lead is a byte length.
 *
 * `opVersion` is the inviter's `CANVAS_OP_VERSION`: contract section 9 turns a MAJOR skew
 * into observer-only, and the acceptor has to know that BEFORE it answers, so it
 * cannot wait for the connection. It is flag-gated rather than mandatory so an
 * answer-shaped or minimal invite pays nothing for it (section 11.19).
 *
 * Two encodings earn their complexity. **ICE credentials pack at 6 bits per char**
 * because RFC 5245's `ice-char` set is `ALPHA / DIGIT / "+" / "/"` - exactly 64
 * characters, so a 24-char ice-pwd is 18 bytes, not 24, by definition rather than by
 * luck. **Addresses go binary when and only when they round-trip**: pack tries the
 * IPv4 / IPv6 / mDNS-uuid forms, re-formats the result and compares it to the input,
 * and falls back to the text form when they differ. That is what makes the round-trip
 * property total - a non-canonical `192.168.001.5` or an odd IPv6 spelling survives
 * verbatim instead of being silently rewritten.
 *
 * Measured by the size test, which prints these as diagnostics so a regression shows
 * up as a number: a LAN invite (tool id + versions + name + colour + opVersion) is
 * **148 B** with three mDNS host candidates, **105 B** with an IPv4 host + srflx pair
 * and **98 B** with a single host candidate; the matching answers are **115 B** and
 * **72 B**. All inside the ≤150 B the QR budget in section 6.1 asks for.
 *
 * ── The two text skins ─────────────────────────────────────────────────────────
 *
 * **`'link'` - base64url**, unpadded, for `#/join?inv=…`. URL-safe with no percent
 * escaping, and it is the densest skin per character, which is what a link wants.
 *
 * **`'qr'` - base32** (RFC 4648, `A-Z` + `2-7`), for the QR skin and its paste
 * fallback. QR's *alphanumeric* mode draws from a fixed 45-character set
 * (`0-9 A-Z SP $ % * + - . / :`) at 11 bits per character PAIR - 5.5 bits/char
 * against byte mode's 8. A token that stays inside that set is therefore smaller on
 * the symbol even though base32 spends more characters per byte than base64:
 *
 *   120 B payload → base64url: 160 chars × 8 bits   = 1,280 bits (byte mode)
 *                 → base32:    192 chars × 5.5 bits = 1,056 bits (alphanumeric)
 *
 * - about a QR version smaller, i.e. a visibly coarser symbol that scans from
 * further away and off a worse screen. base45 (RFC 9285, the EU covid-certificate
 * encoding) is denser still (~990 bits here) but its alphabet includes SPACE and
 * `$ % * + . / :`: a token that cannot be double-click-selected, survives chat
 * clients badly, and needs escaping in a URL. Since this same skin IS the paste
 * fallback everywhere BarcodeDetector is missing (section 11.27), the ~6 % symbol saving
 * loses to "selectable, unambiguous, typeable". RFC 4648's alphabet also omits
 * 0/1/8/9 precisely so O/0, I/1 and B/8 cannot be copied down wrong.
 *
 * The in-repo QR encoder (`community/qr-code/hooks.js`) implements byte mode only
 * today, so the skin costs nothing there and pays off the moment an alphanumeric
 * encoder is wired in - the payload does not change either way.
 *
 * Pure, DOM-free, dependency-free: the ceremony state machine (wave 2.2) and any
 * future non-browser shell import the same functions.
 */

// ── Public shape ──────────────────────────────────────────────────────────────

/** Bump ONLY with a new binary shape; old tokens must fail loudly, never silently. */
export const SDP_CODEC_VERSION = 1;

/** Query params the ceremony uses for the two legs (section 6.1, section 11.25). */
export const INVITE_PARAM = 'inv';
export const ANSWER_PARAM = 'ans';

/** Hard caps. Everything untrusted is measured against one of these BEFORE work. */
export const MAX_SDP_CHARS = 64 * 1024;
export const MAX_TOKEN_CHARS = 4096;
export const MAX_PAYLOAD_BYTES = 512;
export const MAX_CANDIDATES = 8;
export const MAX_TOOL_ID_BYTES = 64;
export const MAX_VERSION_BYTES = 32;
export const MAX_NAME_BYTES = 48;
/** RFC 5245 section 15.4 minimums - libwebrtc enforces them, so we refuse them early. */
export const MIN_UFRAG_CHARS = 4;
export const MIN_PWD_CHARS = 22;
const MAX_ICE_CHARS = 127;
const MAX_ADDRESS_CHARS = 255;

/** Only these three. A SHA-1 fingerprint would weaken the pairing's trust root. */
export type FingerprintAlgo = 'sha-256' | 'sha-384' | 'sha-512';

export type SetupRole = 'actpass' | 'active' | 'passive';

export interface DtlsFingerprint {
  algo: FingerprintAlgo;
  /** Raw digest bytes (32 / 48 / 64) - the `AA:BB:…` hex is a presentation detail. */
  bytes: Uint8Array;
}

export interface IceCandidate {
  /** `relay` never appears: no TURN in OSS (section 6.2a), so it is dropped at extract. */
  type: 'host' | 'srflx';
  protocol: 'udp' | 'tcp';
  /** IPv4, IPv6, an mDNS `<uuid>.local` name, or any other host token, verbatim. */
  address: string;
  port: number;
  /** Absent by default - see `extract`'s note on why order beats the raw number. */
  priority?: number;
  /** Only meaningful for `protocol: 'tcp'`; defaults to passive. */
  tcpActive?: boolean;
}

/** Everything that varies between one browser's offer and another's. */
export interface SdpMaterial {
  fingerprint: DtlsFingerprint;
  iceUfrag: string;
  icePwd: string;
  candidates: IceCandidate[];
  setupRole: SetupRole;
}

/** What an invite carries beyond the connection material (section 6.1). */
export interface InviteMeta {
  v: typeof SDP_CODEC_VERSION;
  /** The tool both peers must already have - probed locally before accepting. */
  toolId: string;
  toolVersion: string;
  engineVersion: string;
  /** Chosen display name, never a profile field (section 11.23). */
  name?: string;
  /** Index into the brand-derived collaborator palette (section 4.4). 0..254. */
  colorIndex?: number;
  /**
   * The inviter's `CANVAS_OP_VERSION`. Optional in the wire shape (flag-gated, free
   * when absent) but the acceptor needs it before answering: a MAJOR skew means
   * observer-only, not "find out once connected" (contract section 9, section 11.19).
   */
  opVersion?: string;
}

export type CollabPayload =
  | { kind: 'invite'; material: SdpMaterial; invite: InviteMeta }
  | { kind: 'answer'; material: SdpMaterial };

export type TokenSkin = 'link' | 'qr';

export type CodecErrorCode =
  | 'empty'
  | 'too-large'
  | 'bad-charset'
  | 'unsupported-version'
  | 'truncated'
  | 'trailing-bytes'
  | 'bad-field'
  | 'not-sdp';

export interface CodecFailure {
  ok: false;
  code: CodecErrorCode;
  /** Human-readable and safe to surface - never echoes the offending bytes. */
  reason: string;
}

export type CodecResult<T> = { ok: true; value: T } | CodecFailure;

// ── Internal failure plumbing ─────────────────────────────────────────────────

// Deep parsers signal by throwing this and ONLY this; every public entry point
// wraps its body in `guard`, so "never throws raw" is structural rather than a
// discipline every early-return has to remember.
class CodecFail extends Error {
  code: CodecErrorCode;
  reason: string;
  constructor(code: CodecErrorCode, reason: string) {
    super(reason);
    this.name = 'CodecFail';
    this.code = code;
    this.reason = reason;
  }
}

function fail(code: CodecErrorCode, reason: string): never {
  throw new CodecFail(code, reason);
}

function guard<T>(fn: () => T): CodecResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    if (err instanceof CodecFail) return { ok: false, code: err.code, reason: err.reason };
    // A bug here must still not throw at a caller decoding a stranger's payload.
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, code: 'bad-field', reason: `sdp-codec: unexpected failure (${detail})` };
  }
}

// ── Byte reader / writer ──────────────────────────────────────────────────────

interface Reader {
  bytes: Uint8Array;
  pos: number;
}

function readU8(r: Reader): number {
  if (r.pos >= r.bytes.length) fail('truncated', 'sdp-codec: payload ends mid-field');
  return r.bytes[r.pos++]!;
}

function readU16(r: Reader): number {
  return (readU8(r) << 8) | readU8(r);
}

function readU32(r: Reader): number {
  return ((readU8(r) << 24) >>> 0) + (readU8(r) << 16) + (readU8(r) << 8) + readU8(r);
}

function readBytes(r: Reader, n: number): Uint8Array {
  if (n < 0 || r.pos + n > r.bytes.length) fail('truncated', 'sdp-codec: payload ends mid-field');
  const out = r.bytes.slice(r.pos, r.pos + n);
  r.pos += n;
  return out;
}

function writeU16(out: number[], v: number): void {
  out.push((v >>> 8) & 0xff, v & 0xff);
}

function writeU32(out: number[], v: number): void {
  out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

// ── Strings ───────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * No C0/C1 control - and no invisible or bidi-rewriting format character - ever
 * reaches SDP text or a rendered name chip. Written as a scan rather than a regex on
 * purpose: a character class of literal control codes is both unreadable and
 * (rightly) a lint error, and this is the check that stops a decoded `name` from
 * carrying a CRLF into anything that later concatenates it.
 *
 * The second half of the list is not padding. `name` is a stranger's display string
 * in a pairing whose whole trust model is "the person you meant to pair with"
 * (section 11.23), and the C0/C1 scan alone let two attacks through the chip: an
 * unterminated RIGHT-TO-LEFT OVERRIDE reverses the chrome printed after it, and a
 * zero-width space or ZWNBSP renders a chip pixel-identical to another
 * collaborator's name. Neither appears in a name a person would type, so refusing
 * them costs nothing real. The 48-byte cap bounds the damage; it does not prevent it.
 */
function hasUnsafeChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true;   // C0 / C1 controls
    if (c >= 0x200b && c <= 0x200f) return true;             // ZWSP · ZWNJ · ZWJ · LRM · RLM
    if (c === 0x2028 || c === 0x2029) return true;           // line / paragraph separator
    if (c >= 0x202a && c <= 0x202e) return true;             // bidi embeddings + overrides
    if (c >= 0x2066 && c <= 0x2069) return true;             // bidi isolates
    if (c === 0xfeff) return true;                           // ZWNBSP (BOM)
  }
  return false;
}

function writeString(out: number[], s: string, maxBytes: number, label: string): void {
  if (hasUnsafeChar(s)) fail('bad-field', `sdp-codec: ${label} contains a control or invisible character`);
  const bytes = encoder.encode(s);
  if (bytes.length > maxBytes) fail('too-large', `sdp-codec: ${label} exceeds ${maxBytes} bytes`);
  out.push(bytes.length);
  for (const b of bytes) out.push(b);
}

function readString(r: Reader, maxBytes: number, label: string): string {
  const len = readU8(r);
  if (len > maxBytes) fail('too-large', `sdp-codec: ${label} exceeds ${maxBytes} bytes`);
  const raw = readBytes(r, len);
  let s: string;
  try {
    s = decoder.decode(raw);
  } catch {
    return fail('bad-charset', `sdp-codec: ${label} is not valid UTF-8`);
  }
  if (hasUnsafeChar(s)) fail('bad-field', `sdp-codec: ${label} contains a control or invisible character`);
  return s;
}

const SEMVER_COMPACT = 0x80;
const SEMVER_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function writeVersionField(out: number[], v: string, label: string): void {
  const m = SEMVER_RE.exec(v);
  if (m) {
    const parts = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
    // Only take the compact path when it re-renders to the SAME string - "1.010.0"
    // would otherwise come back as "1.10.0" and break the round-trip property.
    if (parts.every(n => n <= 255) && parts.join('.') === v) {
      out.push(SEMVER_COMPACT, parts[0], parts[1], parts[2]);
      return;
    }
  }
  writeString(out, v, MAX_VERSION_BYTES, label);
}

function readVersionField(r: Reader, label: string): string {
  const lead = readU8(r);
  if ((lead & SEMVER_COMPACT) !== 0) {
    if (lead !== SEMVER_COMPACT) fail('bad-field', `sdp-codec: ${label} has reserved bits set`);
    return `${readU8(r)}.${readU8(r)}.${readU8(r)}`;
  }
  r.pos -= 1;
  const s = readString(r, MAX_VERSION_BYTES, label);
  if (s.length === 0) fail('bad-field', `sdp-codec: ${label} is empty`);
  return s;
}

// ── ICE credentials at 6 bits per character ───────────────────────────────────

// RFC 5245: ice-char = ALPHA / DIGIT / "+" / "/" - exactly 64 symbols, so an ICE
// ufrag/pwd is a base64 string by definition and packs losslessly at 6 bits/char.
// Anything outside the set is refused rather than escaped: it is non-conformant AND
// it is the only way a decoded credential could carry a CRLF into reconstructed SDP.
const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ICE_INDEX = new Map<string, number>();
for (let i = 0; i < ICE_CHARS.length; i++) ICE_INDEX.set(ICE_CHARS[i]!, i);

function assertIceCreds(ufrag: string, pwd: string): void {
  checkIceString(ufrag, MIN_UFRAG_CHARS, 'ice-ufrag');
  checkIceString(pwd, MIN_PWD_CHARS, 'ice-pwd');
}

function checkIceString(s: string, min: number, label: string): void {
  if (s.length < min) fail('bad-field', `sdp-codec: ${label} must be at least ${min} characters`);
  if (s.length > MAX_ICE_CHARS) fail('too-large', `sdp-codec: ${label} exceeds ${MAX_ICE_CHARS} characters`);
  for (const ch of s) {
    if (!ICE_INDEX.has(ch)) fail('bad-charset', `sdp-codec: ${label} has a non-ICE character`);
  }
}

function writeIce(out: number[], s: string): void {
  out.push(s.length);
  let acc = 0;
  let bits = 0;
  for (const ch of s) {
    acc = (acc << 6) | ICE_INDEX.get(ch)!;
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  if (bits > 0) out.push((acc << (8 - bits)) & 0xff);
}

function readIce(r: Reader, label: string): string {
  const len = readU8(r);
  if (len === 0) fail('bad-field', `sdp-codec: ${label} is empty`);
  if (len > MAX_ICE_CHARS) fail('too-large', `sdp-codec: ${label} exceeds ${MAX_ICE_CHARS} characters`);
  const raw = readBytes(r, Math.ceil((len * 6) / 8));
  let acc = 0;
  let bits = 0;
  let out = '';
  for (const b of raw) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 6 && out.length < len) {
      bits -= 6;
      out += ICE_CHARS[(acc >> bits) & 0x3f];
    }
  }
  // Canonical form: the leftover bits are padding and must be zero, so one payload
  // has exactly one encoding (a decoder that shrugs at them accepts N spellings).
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) {
    fail('bad-field', `sdp-codec: ${label} has non-zero padding bits`);
  }
  return out;
}

// ── Addresses ─────────────────────────────────────────────────────────────────

const ADDR_IPV4 = 0;
const ADDR_IPV6 = 1;
const ADDR_MDNS = 2;
const ADDR_TEXT = 3;

// A host token in a candidate line: IP literal, mDNS name or FQDN. The whitelist is
// what guarantees a decoded address cannot inject an SDP line or a space-separated
// extra candidate field.
const ADDRESS_RE = /^[A-Za-z0-9._:-]{1,255}$/;
const MDNS_RE = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/;

function parseIpv4(s: string): Uint8Array | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const n = Number(m[i + 1]);
    if (!Number.isInteger(n) || n > 255) return null;
    out[i] = n;
  }
  return out;
}

function formatIpv4(b: Uint8Array): string {
  return `${b[0]}.${b[1]}.${b[2]}.${b[3]}`;
}

function parseIpv6(s: string): Uint8Array | null {
  if (!/^[0-9A-Fa-f:.]{2,45}$/.test(s)) return null;
  if (s.includes(':::')) return null;
  const dbl = s.indexOf('::');
  if (dbl !== s.lastIndexOf('::')) return null;
  const [headText, tailText] = dbl >= 0 ? [s.slice(0, dbl), s.slice(dbl + 2)] : [s, null];
  const groups: number[] = [];
  const push = (text: string, into: number[]): boolean => {
    if (text === '') return true;
    const parts = text.split(':');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (part.includes('.')) {
        // A dotted IPv4 tail is only legal as the final element.
        if (i !== parts.length - 1) return false;
        const quad = parseIpv4(part);
        if (!quad) return false;
        into.push((quad[0]! << 8) | quad[1]!, (quad[2]! << 8) | quad[3]!);
        continue;
      }
      if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return false;
      into.push(Number.parseInt(part, 16));
    }
    return true;
  };
  const head: number[] = [];
  const tail: number[] = [];
  if (!push(headText, head)) return null;
  if (tailText !== null && !push(tailText, tail)) return null;
  if (tailText === null) {
    if (head.length !== 8) return null;
    groups.push(...head);
  } else {
    const gap = 8 - head.length - tail.length;
    if (gap < 1) return null;
    groups.push(...head, ...new Array<number>(gap).fill(0), ...tail);
  }
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    out[i * 2] = (groups[i]! >> 8) & 0xff;
    out[i * 2 + 1] = groups[i]! & 0xff;
  }
  return out;
}

/** RFC 5952: lowercase, no leading zeros, longest zero run compressed (leftmost). */
function formatIpv6(b: Uint8Array): string {
  const groups: number[] = [];
  for (let i = 0; i < 8; i++) groups.push((b[i * 2]! << 8) | b[i * 2 + 1]!);
  let bestStart = -1;
  let bestLen = 0;
  let start = -1;
  for (let i = 0; i <= 8; i++) {
    if (i < 8 && groups[i] === 0) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      const len = i - start;
      if (len > bestLen) {
        bestLen = len;
        bestStart = start;
      }
      start = -1;
    }
  }
  if (bestLen < 2) return groups.map(g => g.toString(16)).join(':');
  const head = groups.slice(0, bestStart).map(g => g.toString(16)).join(':');
  const tail = groups.slice(bestStart + bestLen).map(g => g.toString(16)).join(':');
  return `${head}::${tail}`;
}

function parseMdns(s: string): Uint8Array | null {
  const m = MDNS_RE.exec(s);
  if (!m) return null;
  const hex = m.slice(1).join('');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function formatMdns(b: Uint8Array): string {
  let hex = '';
  for (const byte of b) hex += byte.toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.local`;
}

/**
 * Pick the smallest encoding that provably round-trips. Every compact form is
 * re-formatted and compared to the input before it is chosen, so an address this
 * codec cannot spell identically is carried as text rather than quietly rewritten.
 */
function writeAddress(out: number[], address: string): number {
  if (!ADDRESS_RE.test(address)) fail('bad-charset', 'sdp-codec: candidate address has an illegal character');
  const mdns = parseMdns(address);
  if (mdns && formatMdns(mdns) === address) {
    for (const b of mdns) out.push(b);
    return ADDR_MDNS;
  }
  const v4 = parseIpv4(address);
  if (v4 && formatIpv4(v4) === address) {
    for (const b of v4) out.push(b);
    return ADDR_IPV4;
  }
  const v6 = parseIpv6(address);
  if (v6 && formatIpv6(v6) === address) {
    for (const b of v6) out.push(b);
    return ADDR_IPV6;
  }
  writeString(out, address, MAX_ADDRESS_CHARS, 'candidate address');
  return ADDR_TEXT;
}

function readAddress(r: Reader, kind: number): string {
  if (kind === ADDR_IPV4) return formatIpv4(readBytes(r, 4));
  if (kind === ADDR_IPV6) return formatIpv6(readBytes(r, 16));
  if (kind === ADDR_MDNS) return formatMdns(readBytes(r, 16));
  const s = readString(r, MAX_ADDRESS_CHARS, 'candidate address');
  if (!ADDRESS_RE.test(s)) fail('bad-charset', 'sdp-codec: candidate address has an illegal character');
  return s;
}

// ── pack / unpack ─────────────────────────────────────────────────────────────

const FP_ALGOS: readonly FingerprintAlgo[] = ['sha-256', 'sha-384', 'sha-512'];
const FP_LENGTHS: Readonly<Record<FingerprintAlgo, number>> = {
  'sha-256': 32,
  'sha-384': 48,
  'sha-512': 64,
};
const SETUP_ROLES: readonly SetupRole[] = ['actpass', 'active', 'passive'];
const TOOL_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
/**
 * Ids that would resolve on a bare object's prototype chain. The charset above
 * refuses `__proto__` only incidentally (its leading `_`), and `constructor` /
 * `prototype` are ordinary lowercase words that sail through - but the decoded id
 * goes straight into the acceptor's "do I actually have this tool?" probe (section 6.1),
 * and a probe that indexes a plain-object catalog map would answer *yes* for a tool
 * that does not exist. Three words refused here beats requiring every future
 * consumer to remember to use a `Map`.
 */
const RESERVED_TOOL_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const COLOR_ABSENT = 0xff;

function checkMaterial(m: SdpMaterial): void {
  const algoIndex = FP_ALGOS.indexOf(m.fingerprint?.algo);
  if (algoIndex < 0) {
    fail('bad-field', 'sdp-codec: unsupported fingerprint algorithm (sha-256/384/512 only)');
  }
  if (m.fingerprint.bytes.length !== FP_LENGTHS[m.fingerprint.algo]) {
    fail('bad-field', `sdp-codec: ${m.fingerprint.algo} fingerprint must be ${FP_LENGTHS[m.fingerprint.algo]} bytes`);
  }
  assertIceCreds(m.iceUfrag, m.icePwd);
  if (SETUP_ROLES.indexOf(m.setupRole) < 0) fail('bad-field', 'sdp-codec: unknown setup role');
  if (m.candidates.length > MAX_CANDIDATES) {
    fail('too-large', `sdp-codec: more than ${MAX_CANDIDATES} candidates`);
  }
  for (const c of m.candidates) {
    if (c.type !== 'host' && c.type !== 'srflx') fail('bad-field', 'sdp-codec: unknown candidate type');
    if (c.protocol !== 'udp' && c.protocol !== 'tcp') fail('bad-field', 'sdp-codec: unknown candidate protocol');
    if (!Number.isInteger(c.port) || c.port < 0 || c.port > 65535) fail('bad-field', 'sdp-codec: candidate port out of range');
    if (c.priority !== undefined) {
      if (!Number.isInteger(c.priority) || c.priority < 0 || c.priority > 0xffffffff) {
        fail('bad-field', 'sdp-codec: candidate priority out of range');
      }
    }
    if (!ADDRESS_RE.test(c.address)) fail('bad-charset', 'sdp-codec: candidate address has an illegal character');
    // `tcpActive` has no meaning on udp, and silently dropping it would make the
    // round-trip lossy - so it is a refusal, not a normalization.
    if (c.protocol !== 'tcp' && c.tcpActive) fail('bad-field', 'sdp-codec: tcpActive on a udp candidate');
  }
}

function checkInvite(meta: InviteMeta): void {
  if (meta.v !== SDP_CODEC_VERSION) {
    fail('unsupported-version', `sdp-codec: invite metadata is v${String(meta.v)}, this build speaks v${SDP_CODEC_VERSION}`);
  }
  if (
    !TOOL_ID_RE.test(meta.toolId)
    || RESERVED_TOOL_IDS.has(meta.toolId)
    || encoder.encode(meta.toolId).length > MAX_TOOL_ID_BYTES
  ) {
    fail('bad-field', 'sdp-codec: toolId is not a catalog tool id');
  }
  if (meta.colorIndex !== undefined) {
    if (!Number.isInteger(meta.colorIndex) || meta.colorIndex < 0 || meta.colorIndex >= COLOR_ABSENT) {
      fail('bad-field', `sdp-codec: colorIndex must be 0..${COLOR_ABSENT - 1}`);
    }
  }
}

/** Serialize an invite or an answer into its compact binary record. */
export function pack(payload: CollabPayload): CodecResult<Uint8Array> {
  return guard(() => {
    const material = payload?.material;
    if (!material) fail('bad-field', 'sdp-codec: payload has no material');
    checkMaterial(material);
    const invite = payload.kind === 'invite' ? payload.invite : null;
    if (payload.kind !== 'invite' && payload.kind !== 'answer') fail('bad-field', 'sdp-codec: unknown payload kind');
    if (invite) checkInvite(invite);

    const out: number[] = [];
    out.push(SDP_CODEC_VERSION);
    const algoIndex = FP_ALGOS.indexOf(material.fingerprint.algo);
    out.push(
      (invite ? 1 : 0) |
        (SETUP_ROLES.indexOf(material.setupRole) << 2) |
        (algoIndex << 4) |
        (invite?.opVersion !== undefined ? 1 << 6 : 0),
    );
    for (const b of material.fingerprint.bytes) out.push(b);
    writeIce(out, material.iceUfrag);
    writeIce(out, material.icePwd);

    out.push(material.candidates.length);
    for (const c of material.candidates) {
      const flagsAt = out.length;
      out.push(0);
      const addrKind = writeAddress(out, c.address);
      writeU16(out, c.port);
      if (c.priority !== undefined) writeU32(out, c.priority);
      out[flagsAt] =
        addrKind |
        (c.protocol === 'tcp' ? 1 << 2 : 0) |
        (c.type === 'srflx' ? 1 << 3 : 0) |
        (c.priority !== undefined ? 1 << 4 : 0) |
        (c.protocol === 'tcp' && c.tcpActive ? 1 << 5 : 0);
    }

    if (invite) {
      writeString(out, invite.toolId, MAX_TOOL_ID_BYTES, 'toolId');
      writeVersionField(out, invite.toolVersion, 'toolVersion');
      writeVersionField(out, invite.engineVersion, 'engineVersion');
      writeString(out, invite.name ?? '', MAX_NAME_BYTES, 'name');
      out.push(invite.colorIndex ?? COLOR_ABSENT);
      if (invite.opVersion !== undefined) writeVersionField(out, invite.opVersion, 'opVersion');
    }

    if (out.length > MAX_PAYLOAD_BYTES) fail('too-large', `sdp-codec: payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
    return Uint8Array.from(out);
  });
}

/** Parse a binary record. Untrusted input: caps first, exact consumption last. */
export function unpack(bytes: Uint8Array): CodecResult<CollabPayload> {
  return guard(() => {
    if (!(bytes instanceof Uint8Array)) fail('bad-field', 'sdp-codec: expected bytes');
    if (bytes.length === 0) fail('empty', 'sdp-codec: empty payload');
    if (bytes.length > MAX_PAYLOAD_BYTES) fail('too-large', `sdp-codec: payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);

    const r: Reader = { bytes, pos: 0 };
    const version = readU8(r);
    if (version !== SDP_CODEC_VERSION) {
      fail('unsupported-version', `sdp-codec: payload is v${version}, this build speaks v${SDP_CODEC_VERSION}`);
    }
    const header = readU8(r);
    if ((header & 0x80) !== 0) fail('bad-field', 'sdp-codec: header has reserved bits set');
    const kindBits = header & 0b11;
    if (kindBits > 1) fail('bad-field', 'sdp-codec: unknown payload kind');
    const hasOpVersion = (header & (1 << 6)) !== 0;
    if (hasOpVersion && kindBits === 0) fail('bad-field', 'sdp-codec: an answer carries no opVersion');
    const setupRole = SETUP_ROLES[(header >> 2) & 0b11];
    if (!setupRole) fail('bad-field', 'sdp-codec: unknown setup role');
    const algo = FP_ALGOS[(header >> 4) & 0b11];
    if (!algo) fail('bad-field', 'sdp-codec: unsupported fingerprint algorithm (sha-256/384/512 only)');

    const fingerprint: DtlsFingerprint = { algo, bytes: readBytes(r, FP_LENGTHS[algo]) };
    const iceUfrag = readIce(r, 'ice-ufrag');
    const icePwd = readIce(r, 'ice-pwd');
    assertIceCreds(iceUfrag, icePwd);

    const count = readU8(r);
    if (count > MAX_CANDIDATES) fail('too-large', `sdp-codec: more than ${MAX_CANDIDATES} candidates`);
    const candidates: IceCandidate[] = [];
    for (let i = 0; i < count; i++) {
      const flags = readU8(r);
      if ((flags & 0xc0) !== 0) fail('bad-field', 'sdp-codec: candidate flags have reserved bits set');
      const address = readAddress(r, flags & 0b11);
      const port = readU16(r);
      const protocol = (flags & (1 << 2)) !== 0 ? 'tcp' : 'udp';
      const candidate: IceCandidate = {
        type: (flags & (1 << 3)) !== 0 ? 'srflx' : 'host',
        protocol,
        address,
        port,
      };
      if ((flags & (1 << 4)) !== 0) candidate.priority = readU32(r);
      if (protocol === 'tcp' && (flags & (1 << 5)) !== 0) candidate.tcpActive = true;
      else if (protocol === 'udp' && (flags & (1 << 5)) !== 0) {
        fail('bad-field', 'sdp-codec: tcptype flag set on a udp candidate');
      }
      candidates.push(candidate);
    }

    const material: SdpMaterial = { fingerprint, iceUfrag, icePwd, candidates, setupRole };

    if (kindBits === 0) {
      if (r.pos !== bytes.length) fail('trailing-bytes', 'sdp-codec: unexpected bytes after the answer');
      return { kind: 'answer', material } satisfies CollabPayload;
    }

    const toolId = readString(r, MAX_TOOL_ID_BYTES, 'toolId');
    const toolVersion = readVersionField(r, 'toolVersion');
    const engineVersion = readVersionField(r, 'engineVersion');
    const name = readString(r, MAX_NAME_BYTES, 'name');
    const colorIndex = readU8(r);
    const opVersion = hasOpVersion ? readVersionField(r, 'opVersion') : undefined;
    if (r.pos !== bytes.length) fail('trailing-bytes', 'sdp-codec: unexpected bytes after the invite');

    const invite: InviteMeta = { v: SDP_CODEC_VERSION, toolId, toolVersion, engineVersion };
    if (name !== '') invite.name = name;
    if (colorIndex !== COLOR_ABSENT) invite.colorIndex = colorIndex;
    if (opVersion !== undefined) invite.opVersion = opVersion;
    checkInvite(invite);
    return { kind: 'invite', material, invite } satisfies CollabPayload;
  });
}

// ── Text skins ────────────────────────────────────────────────────────────────

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64URL_INDEX = new Map<string, number>();
for (let i = 0; i < B64URL.length; i++) B64URL_INDEX.set(B64URL[i]!, i);
// Tolerate a token pasted in the standard alphabet - one character class, no ambiguity.
B64URL_INDEX.set('+', 62);
B64URL_INDEX.set('/', 63);

/** RFC 4648 base32 - every character is inside QR's 45-symbol alphanumeric set. */
export const QR_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const QR_INDEX = new Map<string, number>();
for (let i = 0; i < QR_ALPHABET.length; i++) QR_INDEX.set(QR_ALPHABET[i]!, i);

// Whitespace a paste or a share sheet may have introduced is never data in either
// skin. A HYPHEN is different and the difference matters: base32 has no `-`,
// so it is free there as a readability grouper - but `-` is character 62 of
// base64url, so stripping it from a link token silently corrupts the payload.
const WHITESPACE_RE = /\s+/g;
const QR_SEPARATORS_RE = /[\s-]+/g;

function encodeBits(bytes: Uint8Array, alphabet: string, width: number): string {
  let acc = 0;
  let bits = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= width) {
      bits -= width;
      out += alphabet[(acc >> bits) & ((1 << width) - 1)];
    }
  }
  if (bits > 0) out += alphabet[(acc << (width - bits)) & ((1 << width) - 1)];
  return out;
}

function decodeBits(text: string, index: Map<string, number>, width: number, skin: TokenSkin): Uint8Array {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const ch of text) {
    const v = index.get(ch);
    if (v === undefined) fail('bad-charset', `sdp-codec: ${skin} token has a character outside its alphabet`);
    acc = (acc << width) | v;
    bits += width;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= width) fail('truncated', `sdp-codec: ${skin} token ends mid-byte`);
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) {
    fail('bad-field', `sdp-codec: ${skin} token has non-zero padding bits`);
  }
  return Uint8Array.from(out);
}

/** Bytes → the text a link or a QR carries. Total: any byte string has a token. */
export function encodeToken(bytes: Uint8Array, skin: TokenSkin): string {
  return skin === 'qr' ? encodeBits(bytes, QR_ALPHABET, 5) : encodeBits(bytes, B64URL, 6);
}

/**
 * Token → bytes. Tolerant where tolerance is unambiguous (whitespace in both skins,
 * grouping hyphens and lowercase in the QR skin, `=` padding in the link skin) and
 * strict everywhere it is not - one payload has exactly one canonical token.
 */
export function decodeToken(text: string, skin: TokenSkin): CodecResult<Uint8Array> {
  return guard(() => {
    if (typeof text !== 'string') fail('bad-field', 'sdp-codec: expected a token string');
    if (text.length > MAX_TOKEN_CHARS) fail('too-large', `sdp-codec: token exceeds ${MAX_TOKEN_CHARS} characters`);
    let cleaned = text.replace(skin === 'qr' ? QR_SEPARATORS_RE : WHITESPACE_RE, '');
    if (skin === 'qr') cleaned = cleaned.toUpperCase();
    else cleaned = cleaned.replace(/=+$/, '');
    if (cleaned.length === 0) fail('empty', 'sdp-codec: empty token');
    return skin === 'qr'
      ? decodeBits(cleaned, QR_INDEX, 5, 'qr')
      : decodeBits(cleaned, B64URL_INDEX, 6, 'link');
  });
}

/**
 * Which skin a pasted token is in. A base64url token of real payload bytes is
 * essentially never all-[A-Z2-7] (a single lowercase letter, `-`, `_`, `0`, `1`,
 * `8` or `9` settles it, and one appears with probability ~1 within a few chars),
 * so the charset is a safe tell. Callers that KNOW the skin should still say so - 
 * a link param is always `'link'`, a scan is always `'qr'`.
 */
export function sniffSkin(text: string): TokenSkin {
  // Total, like everything else here: a non-string is not a QR alphabet, and
  // `decodeToken`'s own guard is what turns it into a typed failure.
  if (typeof text !== 'string') return 'link';
  const cleaned = text.replace(QR_SEPARATORS_RE, '');
  return /^[A-Z2-7]+$/.test(cleaned) ? 'qr' : 'link';
}

/** Payload → token, in one step (the ceremony's outbound path). */
export function encodePayload(payload: CollabPayload, skin: TokenSkin): CodecResult<string> {
  const packed = pack(payload);
  if (!packed.ok) return packed;
  return { ok: true, value: encodeToken(packed.value, skin) };
}

/** Token → payload, in one step (the ceremony's inbound, untrusted path). */
export function decodePayload(text: string, skin: TokenSkin | 'auto' = 'auto'): CodecResult<CollabPayload> {
  // The skin sniff is evaluated as an ARGUMENT, i.e. outside `decodeToken`'s guard,
  // so the type check has to happen before it or the module's "never throws" promise
  // breaks on the shape its own caller produces: `URLSearchParams.get(INVITE_PARAM)`
  // is `string | null`, and a missing `?inv=` must read as a codec failure the join
  // view can render, not as a TypeError that takes the view down.
  if (typeof text !== 'string') {
    return { ok: false, code: 'bad-field', reason: 'sdp-codec: expected a token string' };
  }
  const bytes = decodeToken(text, skin === 'auto' ? sniffSkin(text) : skin);
  if (!bytes.ok) return bytes;
  return unpack(bytes.value);
}

// ── extract ───────────────────────────────────────────────────────────────────

const FP_LINE_RE = /^a=fingerprint:(\S+)\s+(\S+)$/;
const HEX_PAIRS_RE = /^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2})*$/;

function parseFingerprint(algoText: string, hexText: string): DtlsFingerprint {
  const algo = algoText.toLowerCase() as FingerprintAlgo;
  if (FP_ALGOS.indexOf(algo) < 0) {
    fail('bad-field', `sdp-codec: unsupported fingerprint algorithm '${algoText.slice(0, 16)}' (sha-256/384/512 only)`);
  }
  if (!HEX_PAIRS_RE.test(hexText)) fail('bad-field', 'sdp-codec: fingerprint is not colon-separated hex');
  const parts = hexText.split(':');
  if (parts.length !== FP_LENGTHS[algo]) {
    fail('bad-field', `sdp-codec: ${algo} fingerprint must be ${FP_LENGTHS[algo]} bytes`);
  }
  const bytes = new Uint8Array(parts.length);
  for (let i = 0; i < parts.length; i++) bytes[i] = Number.parseInt(parts[i]!, 16);
  return { algo, bytes };
}

export interface ExtractOptions {
  /**
   * Carry each candidate's priority verbatim (4 bytes each). Off by default: what
   * ICE actually needs from us is the ORDER and the type preference, and
   * `reconstruct` recomputes RFC 8445 priorities that preserve both. Dropping them
   * is what keeps three candidates inside the QR budget; the browser's
   * interface-cost nuance is not worth 12 bytes on a LAN pair.
   */
  keepPriority?: boolean;
}

/**
 * Pull the varying material out of a real SDP (our own offer/answer, or a peer's).
 * Deliberately lenient about line endings, attribute placement (Firefox puts the
 * fingerprint at session level, Chrome at media level) and candidate extensions,
 * and deliberately strict about what it keeps: component 1 only, udp/tcp only,
 * host/srflx only - `relay` is dropped on principle (no TURN in OSS, section 6.2a) and
 * `prflx` never appears in SDP.
 */
export function extract(sdp: string, opts: ExtractOptions = {}): CodecResult<SdpMaterial> {
  return guard(() => {
    if (typeof sdp !== 'string') fail('bad-field', 'sdp-codec: expected SDP text');
    if (sdp.length === 0) fail('empty', 'sdp-codec: empty SDP');
    if (sdp.length > MAX_SDP_CHARS) fail('too-large', `sdp-codec: SDP exceeds ${MAX_SDP_CHARS} characters`);
    const lines = sdp.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l !== '');
    if (!lines.some(l => l === 'v=0')) fail('not-sdp', 'sdp-codec: no v=0 line - not an SDP');
    if (!lines.some(l => /^m=application\s/.test(l))) {
      fail('not-sdp', 'sdp-codec: no m=application section - not a data-channel description');
    }

    let fingerprint: DtlsFingerprint | null = null;
    let iceUfrag = '';
    let icePwd = '';
    let setupRole: SetupRole = 'actpass';
    const seen = new Set<string>();
    const found: IceCandidate[] = [];

    for (const line of lines) {
      if (!fingerprint) {
        const fp = FP_LINE_RE.exec(line);
        if (fp) fingerprint = parseFingerprint(fp[1]!, fp[2]!);
      }
      if (!iceUfrag && line.startsWith('a=ice-ufrag:')) iceUfrag = line.slice('a=ice-ufrag:'.length);
      if (!icePwd && line.startsWith('a=ice-pwd:')) icePwd = line.slice('a=ice-pwd:'.length);
      if (line.startsWith('a=setup:')) {
        const role = line.slice('a=setup:'.length) as SetupRole;
        if (SETUP_ROLES.indexOf(role) >= 0) setupRole = role;
      }
      if (line.startsWith('a=candidate:')) {
        const c = parseCandidateLine(line.slice('a=candidate:'.length), opts.keepPriority === true);
        if (!c) continue;
        const key = `${c.type}|${c.protocol}|${c.address}|${c.port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(c);
      }
    }

    if (!fingerprint) fail('bad-field', 'sdp-codec: SDP has no usable a=fingerprint line');
    if (!iceUfrag || !icePwd) fail('bad-field', 'sdp-codec: SDP has no ICE credentials');
    assertIceCreds(iceUfrag, icePwd);

    // Keep the best MAX_CANDIDATES: sort by the browser's own priority (descending,
    // original order breaking ties) and truncate. A LAN pair connects on its first
    // host candidate; the tail is what would blow the QR budget.
    const ordered = found
      .map((c, i) => ({ c, i, p: c.priority ?? candidatePriority(c, i) }))
      .sort((a, b) => b.p - a.p || a.i - b.i)
      .slice(0, MAX_CANDIDATES)
      .map(x => x.c);

    const material: SdpMaterial = { fingerprint, iceUfrag, icePwd, candidates: ordered, setupRole };
    checkMaterial(material);
    return material;
  });
}

function parseCandidateLine(rest: string, keepPriority: boolean): IceCandidate | null {
  const t = rest.split(/\s+/);
  // foundation component transport priority address port "typ" type [ext...]
  if (t.length < 8 || t[6] !== 'typ') return null;
  if (t[1] !== '1') return null; // rtcp-mux/data channels use component 1 only
  const protocol = t[2]!.toLowerCase();
  if (protocol !== 'udp' && protocol !== 'tcp') return null;
  const type = t[7]!.toLowerCase();
  if (type !== 'host' && type !== 'srflx') return null;
  const address = t[4]!;
  if (!ADDRESS_RE.test(address)) return null;
  if (!/^\d{1,5}$/.test(t[5]!)) return null;
  const port = Number(t[5]);
  if (port > 65535) return null;
  const candidate: IceCandidate = { type, protocol, address, port };
  if (keepPriority && /^\d{1,10}$/.test(t[3]!)) {
    const priority = Number(t[3]);
    if (priority <= 0xffffffff) candidate.priority = priority;
  }
  if (protocol === 'tcp') {
    for (let i = 8; i < t.length - 1; i++) {
      if (t[i] === 'tcptype' && t[i + 1] === 'active') candidate.tcpActive = true;
    }
  }
  return candidate;
}

// ── reconstruct ───────────────────────────────────────────────────────────────

/**
 * Everything below is identical on every browser's data-channel description, so it
 * is template rather than payload.
 *
 * `max-message-size` is stated as Chrome's 262,144 even when the peer is Firefox
 * (which advertises ~1 GB): the value only bounds what WE send, and section 11.6 caps every
 * message at 64 KB regardless - understating it is free, guessing high is not.
 *
 * `a=ice-options:trickle` is deliberately ABSENT and `a=end-of-candidates` present:
 * the ceremony is non-trickle by construction (section 2.9), and a static payload cannot
 * carry a live back-channel. Saying "trickle" would leave the peer waiting for
 * candidates that can never arrive.
 */
const SCTP_PORT = 5000;
const MAX_MESSAGE_SIZE = 262144;

/** RFC 8445 section 5.1.2.1 type preferences; component 1 throughout. */
const TYPE_PREF: Readonly<Record<IceCandidate['type'], number>> = { host: 126, srflx: 100 };

function candidatePriority(c: IceCandidate, index: number): number {
  const local = Math.max(0, 65535 - index);
  return TYPE_PREF[c.type] * 0x1000000 + local * 256 + 255;
}

/** Same type+protocol share a foundation, per RFC 8445 section 5.1.1.3. */
function candidateFoundation(c: IceCandidate): number {
  return (c.type === 'host' ? 1 : 2) + (c.protocol === 'tcp' ? 2 : 0);
}

function fingerprintHex(fp: DtlsFingerprint): string {
  const parts: string[] = [];
  for (const b of fp.bytes) parts.push(b.toString(16).padStart(2, '0').toUpperCase());
  return parts.join(':');
}

/**
 * A stable, deterministic `o=` session id (FNV-1a over the material, kept under
 * 2^63 per RFC 3264). Deterministic on purpose: `reconstruct` is a pure function, so
 * the same material always yields byte-identical SDP and a test can compare it.
 */
function sessionId(m: SdpMaterial): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const feed = (bytes: Uint8Array | number[]): void => {
    for (const b of bytes) h = ((h ^ BigInt(b)) * prime) & mask;
  };
  feed(m.fingerprint.bytes);
  feed(encoder.encode(`${m.iceUfrag}:${m.icePwd}`));
  return (h >> 1n).toString();
}

/**
 * Rebuild a valid single-data-channel SDP from the material. `kind` decides the
 * one thing an offer and an answer genuinely disagree about: an answer must never
 * say `actpass` (RFC 5763 section 5) - it picks a role - so an answer built from
 * `actpass` material is coerced to `active`, which is what a browser answerer
 * chooses anyway.
 */
export function reconstruct(material: SdpMaterial, kind: 'offer' | 'answer'): CodecResult<string> {
  return guard(() => {
    if (kind !== 'offer' && kind !== 'answer') fail('bad-field', "sdp-codec: kind must be 'offer' or 'answer'");
    checkMaterial(material);
    const setup = kind === 'answer' && material.setupRole === 'actpass' ? 'active' : material.setupRole;
    const lines = [
      'v=0',
      `o=- ${sessionId(material)} 2 IN IP4 127.0.0.1`,
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      // Constant by convention: WebRTC reads addresses off the candidates, never
      // off the c-line, and every browser emits this exact line.
      'c=IN IP4 0.0.0.0',
      'a=mid:0',
      `a=ice-ufrag:${material.iceUfrag}`,
      `a=ice-pwd:${material.icePwd}`,
      `a=fingerprint:${material.fingerprint.algo} ${fingerprintHex(material.fingerprint)}`,
      `a=setup:${setup}`,
      `a=sctp-port:${SCTP_PORT}`,
      `a=max-message-size:${MAX_MESSAGE_SIZE}`,
    ];
    material.candidates.forEach((c, i) => {
      const priority = c.priority ?? candidatePriority(c, i);
      let line = `a=candidate:${candidateFoundation(c)} 1 ${c.protocol} ${priority} ${c.address} ${c.port} typ ${c.type}`;
      // raddr/rport are diagnostics only (RFC 8445 section 5.1.3); browsers themselves emit
      // the null pair when the base is withheld, so it is the honest reconstruction.
      if (c.type === 'srflx') line += ' raddr 0.0.0.0 rport 0';
      if (c.protocol === 'tcp') line += c.tcpActive ? ' tcptype active' : ' tcptype passive';
      lines.push(line);
    });
    lines.push('a=end-of-candidates');
    return `${lines.join('\r\n')}\r\n`;
  });
}
