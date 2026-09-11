// SPDX-License-Identifier: MPL-2.0
/**
 * qr-skin - the QR half of the private-collab ceremony: draw one, scan one
 * (plan 100 section 6.1 skin 2, section 2.9, section 11.27; wave 2.6).
 *
 * The ceremony is two payloads and the humans are the channel (section 6.1). The link skin
 * covers "paste it into something we already trust"; this module covers the other
 * skin - "hold your laptops together" - which is the one that works with no network
 * at all, and is therefore the airgap case's primary path rather than a nicety.
 *
 * ── Why an encoder lives here at all ────────────────────────────────────────────
 *
 * The repo already renders QR codes, but not in a way shell chrome may use: the
 * `qr-code` tool is TOOL DATA - a manifest plus a `hooks.js` that inlines the MIT
 * `qrcode-svg` library and runs inside the engine's `new Function('host', …)` scope.
 * Tools never import from the shell and the shell never imports from tools; that
 * boundary is what lets the same tool run unchanged in the browser, Tauri and the
 * CLI, and reaching across it for a dialog's QR would be the first crack in it.
 * Nothing else in `shells/web/src` or `packages/` encodes a QR. So: a small,
 * purpose-scoped encoder written from ISO/IEC 18004, owned by the shell, no new
 * dependency, no vendored code.
 *
 * "Purpose-scoped" is the honest word for the limits, stated once:
 *
 *   • **Versions 1–10 only** (21×21 up to 57×57 modules). Everything the ceremony
 *     ever draws is far inside that; a symbol denser than v10 is not a symbol two
 *     people scan off a laptop screen, it is a symbol that fails to scan.
 *   • **Error-correction level M only** (~15 % recovery). L is too fragile off a
 *     glossy screen at an angle, Q/H cost a version for reliability we do not need
 *     when the code is 30 cm from the camera.
 *   • **Alphanumeric and byte modes only** - no numeric, no kanji, no ECI. Byte mode
 *     emits UTF-8 without an ECI header (the spec's default byte charset is
 *     ISO-8859-1; every real scanner, `BarcodeDetector` included, sniffs UTF-8). The
 *     ceremony's payload is ASCII, so this only ever matters to another caller.
 *   • **Structured Append is not implemented** - one symbol, never a chain.
 *
 * ── Why alphanumeric mode is required, not an optimisation ──────────────────
 *
 * `sdp-codec.ts` dresses the QR payload in base32 (RFC 4648: `A–Z` + `2–7`)
 * specifically because every character of it is inside QR's 45-symbol alphanumeric
 * set, which packs a character PAIR into 11 bits - 5.5 bits/char against byte mode's
 * 8. That note ends "pays off the moment an alphanumeric encoder is wired in". This
 * is that encoder, and the payoff is not cosmetic:
 *
 *   a typical LAN invite is 148 payload bytes → 237 base32 characters
 *     byte mode:         237 > 213 = the v10-M byte ceiling  → DOES NOT FIT
 *     alphanumeric mode: 237 ≤ 262 = the v9-M alnum ceiling  → version 9, ~10 % spare
 *
 * So byte mode alone would have pushed a routine invite past version 10 (and past
 * any version a laptop screen scans comfortably). Mode selection is automatic:
 * a payload that is entirely inside the alphanumeric set uses alphanumeric, anything
 * else uses byte. Symbol versions for the payload sizes `sdp-codec`'s own size test
 * documents (the test below builds real payloads, re-measures, and prints the numbers
 * as diagnostics, so a capacity regression shows up as a number rather than a vibe):
 *
 *   invite 148 B → 237 chars → version 9  (53×53)   answer 115 B → 184 chars → v8
 *   invite 105 B → 168 chars → version 7  (45×45)   answer  72 B → 116 chars → v5
 *   invite  98 B → 157 chars → version 7  (45×45)
 *
 * Every one of those is inside the version-10 ceiling with room to spare, which is the
 * property that matters: the ceremony never has to explain a QR it could not draw.
 *
 * ── What the QR carries ────────────────────────────────────────────────────────
 *
 * The bare codec token, not a URL. A `#/join?inv=…` link contains lowercase and `/`,
 * which forces byte mode and would blow the budget above twice over - and the QR skin
 * exists precisely for the case where the pair has no shared network to open a link
 * on. The consequence is deliberate and worth stating in the UI: a generic phone
 * camera app pointed at this symbol shows a meaningless block of letters. The scan is
 * OUR dialog's job (below), which is also why `scanQrFromVideo` takes an `accept`
 * predicate - a stray QR in frame must not end the scan.
 *
 * ── Colour: why not `currentColor` by default ──────────────────────────────────
 *
 * A QR must be dark-on-light to scan reliably; `BarcodeDetector`'s backends are not
 * required to try an inverted pass, and several do not. `currentColor` in a dark
 * theme resolves to a LIGHT ink, which would silently produce a symbol that renders
 * beautifully and scans never. So the dark modules are painted `currentColor` with
 * `color="#000"` set on the `<svg>` as a PRESENTATION attribute - lowest priority in
 * the cascade, so the default is always black, and a caller that genuinely controls
 * its surface (a brand-tinted code on a known light card) overrides it with one CSS
 * rule instead of a prop. The light background is a real painted rect by default,
 * including the 4-module quiet zone the spec requires: a transparent QR inherits
 * whatever is behind it, which on this app's dark theme is the failure above.
 *
 * ── Scanning is a progressive rung, never a dead end (section 11.27) ───────────────────
 *
 * `BarcodeDetector` is Chromium-only (and even there it needs a platform barcode
 * backend, which some Linux builds lack - the API can exist and support NO formats).
 * Safari and Firefox have nothing. There is deliberately **no fallback decoder**:
 * shipping a second image-processing pipeline to cover browsers whose users can paste
 * a token in two seconds is the wrong trade. `probeBarcodeDetector()` answers with a
 * machine-readable capability so the dialog can label the option honestly and lead
 * with paste where scanning is impossible - the copy is the dialog's (it is i18n'd,
 * wave 2.7), the fact is this module's.
 *
 * Camera acquisition is NOT here either. Getting a `MediaStream` and a playing
 * `<video>` is the caller's job through the shell's existing idioms - 
 * `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`,
 * exactly as `bridge/media.ts` and `views/picker.ts` do it, with the same
 * teardown discipline (stop every track when the dialog closes). This module takes a
 * video element that is already playing and reads frames off it. That split keeps one
 * camera-permission story in the shell. Note section 11.1's happy
 * accident: the camera grant that scanning needs is also what makes the browser stop
 * hiding host IPs behind mDNS names, so the scan prompt improves the odds that the
 * pairing it is part of connects at all.
 *
 * Pure and DOM-free above the scan section: the encoder and the SVG writer touch no
 * globals, so they run in a worker, in Node's test runner, and in any future shell.
 */

// ── Public shape ──────────────────────────────────────────────────────────────

/** The two modes this encoder speaks. Chosen automatically unless forced. */
export type QrMode = 'alphanumeric' | 'byte';

/** Inclusive version range. See the header for why it stops at 10. */
export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 10;

/** Error-correction level, fixed. Present as a constant so callers can print it. */
export const QR_EC_LEVEL = 'M';

/** ISO/IEC 18004 section 6.3.8: four light modules on every side, or scanners lose the edge. */
export const QR_QUIET_ZONE = 4;

/** QR's 45-symbol alphanumeric set, in value order (index = the symbol's value). */
export const QR_ALPHANUMERIC_SET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export type QrErrorCode =
  /** Nothing to encode. */
  | 'empty'
  /** Does not fit version 10 at level M - the caller falls back to the paste path. */
  | 'too-large'
  /** Not a string, or options out of range. */
  | 'bad-input';

export interface QrFailure {
  ok: false;
  code: QrErrorCode;
  /** Human-readable and safe to surface; never echoes the payload. */
  reason: string;
}

export type QrResult<T> = { ok: true; value: T } | QrFailure;

/** A finished symbol. `modules` is row-major, one byte per module, 1 = dark. */
export interface QrSymbol {
  readonly version: number;
  /** `4 * version + 17`, excluding the quiet zone. */
  readonly size: number;
  readonly mask: number;
  readonly mode: QrMode;
  readonly modules: Uint8Array;
}

/** Is the module at (x, y) dark? Out-of-range reads are light, never a throw. */
export function moduleAt(symbol: QrSymbol, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= symbol.size || y >= symbol.size) return false;
  return symbol.modules[y * symbol.size + x] === 1;
}

export interface QrEncodeOptions {
  /** `'auto'` (default) picks alphanumeric when every character allows it. */
  readonly mode?: QrMode | 'auto';
  /** Force a mask 0–7 instead of the penalty-scored choice. Testing/debug. */
  readonly mask?: number;
  /** Raise the floor (e.g. to keep a set of codes the same size). Default 1. */
  readonly minVersion?: number;
  /** Lower the ceiling. Default (and hard maximum) 10. */
  readonly maxVersion?: number;
}

export interface QrSvgOptions {
  /** Quiet-zone width in modules. Default 4 - below that, scanners start failing. */
  readonly margin?: number;
  /** Paint for the dark modules. Default `currentColor` (see the header). */
  readonly dark?: string;
  /** Background paint, including the quiet zone. `null` omits it (scan-risky). */
  readonly light?: string | null;
  /** Fallback the default `currentColor` resolves to. Default `#000`. */
  readonly color?: string;
  /** Accessible name. Emits `role="img"` + `<title>`; omitted → `aria-hidden`. */
  readonly label?: string;
  /** Fixed pixel size for `width`/`height`. Default: `100%` on both. */
  readonly pixelSize?: number;
}

/** Thrown ONLY by {@link renderQr}; every other entry point returns a typed result. */
export class QrRenderError extends Error {
  code: QrErrorCode;
  constructor(failure: QrFailure) {
    super(failure.reason);
    this.name = 'QrRenderError';
    this.code = failure.code;
  }
}

function fail(code: QrErrorCode, reason: string): QrFailure {
  return { ok: false, code, reason };
}

// ── Version tables (ISO/IEC 18004 Tables 9 and 13) ────────────────────────────

/**
 * EC codewords per block, and block count, at level M for versions 1–10. Everything
 * else - total codewords, data codewords, the size of each block - is DERIVED from
 * these two rows plus the module geometry, so there is one place to be wrong rather
 * than four that must agree. The test pins the derived numbers against the published
 * table, which is the check that the two rows are right.
 */
const EC_PER_BLOCK_M: readonly number[] = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M: readonly number[] = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/** Character-count-indicator widths, by mode, for versions 1–9 and 10–26 (section 8.4). */
const COUNT_BITS: Readonly<Record<QrMode, readonly [number, number]>> = {
  alphanumeric: [9, 11],
  byte: [8, 16],
};

const MODE_INDICATOR: Readonly<Record<QrMode, number>> = { alphanumeric: 0b0010, byte: 0b0100 };

/**
 * Total data-bearing modules in a symbol, before ECC (section 7.4.10's derivation, in closed
 * form). Function patterns scale with the version in a way that is exactly expressible,
 * so this is arithmetic rather than a fourth table to keep in sync.
 */
function rawDataModules(version: number): number {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    n -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) n -= 36; // the two 18-bit version-information blocks
  }
  return n;
}

/** Codewords in the symbol as a whole (data + error correction). */
function totalCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8);
}

/** Codewords available to the message after ECC is reserved. */
function dataCodewords(version: number): number {
  return totalCodewords(version) - EC_PER_BLOCK_M[version]! * BLOCKS_M[version]!;
}

/** Alignment-pattern centre coordinates (section 6.3.5), computed rather than tabulated. */
function alignmentCentres(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < numAlign; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** How many characters of `mode` fit at `version`, level M. Exported for capacity UI. */
export function qrCapacity(version: number, mode: QrMode): number {
  if (!Number.isInteger(version) || version < QR_MIN_VERSION || version > QR_MAX_VERSION) return 0;
  const bits = dataCodewords(version) * 8 - 4 - countBits(version, mode);
  if (bits <= 0) return 0;
  if (mode === 'byte') return Math.floor(bits / 8);
  const pairs = Math.floor(bits / 11);
  return pairs * 2 + (bits - pairs * 11 >= 6 ? 1 : 0);
}

function countBits(version: number, mode: QrMode): number {
  return COUNT_BITS[mode][version <= 9 ? 0 : 1]!;
}

// ── Bit stream ────────────────────────────────────────────────────────────────

/**
 * Bits as one entry each. A version-10 symbol is 1,728 of them - the clarity of
 * "one push per bit" is worth more here than the bytes a packed writer would save.
 */
function appendBits(bits: number[], value: number, width: number): void {
  for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

const ALNUM_INDEX = new Map<string, number>();
for (let i = 0; i < QR_ALPHANUMERIC_SET.length; i++) ALNUM_INDEX.set(QR_ALPHANUMERIC_SET[i]!, i);

function isAlphanumeric(text: string): boolean {
  for (const ch of text) {
    if (!ALNUM_INDEX.has(ch)) return false;
  }
  return true;
}

const textEncoder = new TextEncoder();

/** Bits the payload itself costs, excluding the mode indicator and count field. */
function payloadBits(mode: QrMode, text: string, bytes: Uint8Array): number {
  if (mode === 'byte') return bytes.length * 8;
  return Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
}

function writePayload(bits: number[], mode: QrMode, text: string, bytes: Uint8Array): void {
  if (mode === 'byte') {
    for (const b of bytes) appendBits(bits, b, 8);
    return;
  }
  for (let i = 0; i + 1 < text.length; i += 2) {
    appendBits(bits, ALNUM_INDEX.get(text[i]!)! * 45 + ALNUM_INDEX.get(text[i + 1]!)!, 11);
  }
  if (text.length % 2 === 1) appendBits(bits, ALNUM_INDEX.get(text[text.length - 1]!)!, 6);
}

/** section 8.4.9: terminator, byte alignment, then alternating 0xEC / 0x11 to fill. */
function toDataCodewords(bits: number[], capacityBits: number): Uint8Array {
  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const out = new Uint8Array(capacityBits / 8);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    out[i / 8] = byte;
  }
  for (let i = bits.length / 8, pad = 0; i < out.length; i++, pad++) {
    out[i] = pad % 2 === 0 ? 0xec : 0x11;
  }
  return out;
}

// ── GF(256) and Reed–Solomon (section 8.5) ───────────────────────────────────────────

// The field is GF(2^8) modulo x^8 + x^4 + x^3 + x^2 + 1 (0x11D), generator 2.
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

/**
 * Coefficients of the generator polynomial of the given degree, leading 1 omitted:
 * the product of (x − 2^i) for i in 0..degree−1, built one root at a time.
 */
function rsDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < degree) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return result;
}

/** The remainder of `data` × x^degree divided by the generator - i.e. the EC codewords. */
export function rsEncode(data: Uint8Array, degree: number): Uint8Array {
  const divisor = rsDivisor(degree);
  const result = new Uint8Array(degree);
  for (const b of data) {
    const factor = b ^ result[0]!;
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) result[i] = result[i]! ^ gfMul(divisor[i]!, factor);
  }
  return result;
}

/**
 * section 8.6: split the message into blocks, append each block's EC codewords, then
 * interleave data across blocks and EC across blocks. Block sizes come out of the
 * division rather than a table - the short blocks come first, which is what the
 * standard's grouping means in practice.
 */
function addEccAndInterleave(version: number, data: Uint8Array): Uint8Array {
  const numBlocks = BLOCKS_M[version]!;
  const eccLen = EC_PER_BLOCK_M[version]!;
  const raw = totalCodewords(version);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);

  const blocks: { data: Uint8Array; ecc: Uint8Array }[] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const chunk = data.slice(k, k + len);
    k += len;
    blocks.push({ data: chunk, ecc: rsEncode(chunk, eccLen) });
  }

  const out = new Uint8Array(raw);
  let at = 0;
  const longestData = shortLen - eccLen + (numShort < numBlocks ? 1 : 0);
  for (let i = 0; i < longestData; i++) {
    for (const block of blocks) {
      if (i < block.data.length) out[at++] = block.data[i]!;
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of blocks) out[at++] = block.ecc[i]!;
  }
  return out;
}

// ── Matrix ────────────────────────────────────────────────────────────────────

interface Grid {
  readonly size: number;
  /** 1 = dark. */
  readonly dark: Uint8Array;
  /** 1 = function module (never masked, never carries data). */
  readonly fn: Uint8Array;
}

function put(g: Grid, x: number, y: number, dark: boolean): void {
  g.dark[y * g.size + x] = dark ? 1 : 0;
}

function putFn(g: Grid, x: number, y: number, dark: boolean): void {
  if (x < 0 || y < 0 || x >= g.size || y >= g.size) return;
  put(g, x, y, dark);
  g.fn[y * g.size + x] = 1;
}

function isDark(g: Grid, x: number, y: number): boolean {
  return g.dark[y * g.size + x] === 1;
}

/** BCH(15,5) over the 5 data bits, then the section 8.9 mask 0x5412 so 0 is never all-light. */
function formatBits(mask: number): number {
  // Level M is `00`; the mask number is the low three bits.
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

/** BCH(18,6) over the version number (section 8.10). Only versions ≥ 7 carry it. */
function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return ((version << 12) | rem) & 0x3ffff;
}

function drawFinder(g: Grid, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      // dist 2 is the light ring inside the eye; dist 4 is the separator around it.
      putFn(g, cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      putFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/**
 * The 15 format bits, twice (section 8.9). Called once during the function pass with mask 0
 * purely to RESERVE the modules, then again with the chosen mask to write the truth.
 */
function drawFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) putFn(g, 8, i, bit(i));
  putFn(g, 8, 7, bit(6));
  putFn(g, 8, 8, bit(7));
  putFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) putFn(g, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) putFn(g, g.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) putFn(g, 8, g.size - 15 + i, bit(i));
  putFn(g, 8, g.size - 8, true); // the "dark module", always set
}

function drawFunctionPatterns(g: Grid, version: number): void {
  for (let i = 0; i < g.size; i++) {
    putFn(g, 6, i, i % 2 === 0);
    putFn(g, i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, g.size - 4, 3);
  drawFinder(g, 3, g.size - 4);

  const centres = alignmentCentres(version);
  for (let i = 0; i < centres.length; i++) {
    for (let j = 0; j < centres.length; j++) {
      // The three finder corners are already occupied.
      const corner =
        (i === 0 && j === 0) ||
        (i === 0 && j === centres.length - 1) ||
        (i === centres.length - 1 && j === 0);
      if (!corner) drawAlignment(g, centres[i]!, centres[j]!);
    }
  }

  drawFormat(g, 0); // reservation only; overwritten once the mask is chosen
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = g.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      putFn(g, a, b, bit);
      putFn(g, b, a, bit);
    }
  }
}

/** section 8.7: two-module-wide columns, right to left, snaking up then down, skipping col 6. */
function drawCodewords(g: Grid, codewords: Uint8Array): void {
  let i = 0;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern is not part of a pair
    for (let vert = 0; vert < g.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? g.size - 1 - vert : vert;
        if (g.fn[y * g.size + x] === 1 || i >= codewords.length * 8) continue;
        put(g, x, y, ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1);
        i++;
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

/** XOR the mask over every non-function module. Self-inverse, so it also un-applies. */
function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (g.fn[y * g.size + x] === 1) continue;
      if (maskBit(mask, x, y)) g.dark[y * g.size + x] = g.dark[y * g.size + x]! ^ 1;
    }
  }
}

// section 8.8.2's four rules. N1 = 3, N2 = 3, N3 = 40, N4 = 10.
const FINDER_LIKE = [
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
];

/**
 * Mask-selection penalty. Rule 3 is implemented as a literal 11-module window search
 * for the two finder-like sequences rather than the run-length formulation, which
 * differs only at the symbol's own edge (where the standard treats the outside as
 * light). The effect is confined to mask CHOICE - every candidate is a fully valid
 * symbol either way - so the simpler, obviously-correct reading wins.
 */
function penalty(g: Grid): number {
  const n = g.size;
  let score = 0;

  // Rule 1 - runs of five or more of one colour, in both directions.
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      let runColour = -1;
      let runLength = 0;
      for (let b = 0; b < n; b++) {
        const colour = (pass === 0 ? isDark(g, b, a) : isDark(g, a, b)) ? 1 : 0;
        if (colour === runColour) {
          runLength++;
          if (runLength === 5) score += 3;
          else if (runLength > 5) score += 1;
        } else {
          runColour = colour;
          runLength = 1;
        }
      }
    }
  }

  // Rule 2 - every 2×2 block of one colour.
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = isDark(g, x, y);
      if (c === isDark(g, x + 1, y) && c === isDark(g, x, y + 1) && c === isDark(g, x + 1, y + 1)) {
        score += 3;
      }
    }
  }

  // Rule 3 - 1:1:3:1:1 finder-like patterns with their four light modules.
  for (const pattern of FINDER_LIKE) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b + 11 <= n; b++) {
        let rowHit = true;
        let colHit = true;
        for (let k = 0; k < 11; k++) {
          const want = pattern[k] === 1;
          if (rowHit && isDark(g, b + k, a) !== want) rowHit = false;
          if (colHit && isDark(g, a, b + k) !== want) colHit = false;
          if (!rowHit && !colHit) break;
        }
        if (rowHit) score += 40;
        if (colHit) score += 40;
      }
    }
  }

  // Rule 4 - deviation of the dark proportion from 50 %, in 5 % steps.
  let dark = 0;
  for (let i = 0; i < g.dark.length; i++) dark += g.dark[i]!;
  const total = n * n;
  score += Math.floor(Math.abs(dark * 100 - total * 50) / (total * 5)) * 10;

  return score;
}

// ── encode ────────────────────────────────────────────────────────────────────

/**
 * Text → a finished symbol. Never throws: bad options, an empty string and an
 * over-capacity payload all come back as typed failures, because the caller of record
 * is a dialog rendering a stranger-facing ceremony and its fallback is the paste path.
 */
export function encodeQr(text: string, opts: QrEncodeOptions = {}): QrResult<QrSymbol> {
  if (typeof text !== 'string') return fail('bad-input', 'qr: expected a string to encode');
  if (text.length === 0) return fail('empty', 'qr: nothing to encode');

  const minVersion = opts.minVersion ?? QR_MIN_VERSION;
  const maxVersion = opts.maxVersion ?? QR_MAX_VERSION;
  if (
    !Number.isInteger(minVersion) || !Number.isInteger(maxVersion) ||
    minVersion < QR_MIN_VERSION || maxVersion > QR_MAX_VERSION || minVersion > maxVersion
  ) {
    return fail('bad-input', `qr: version range must sit inside ${QR_MIN_VERSION}..${QR_MAX_VERSION}`);
  }
  const forcedMask = opts.mask;
  if (forcedMask !== undefined && (!Number.isInteger(forcedMask) || forcedMask < 0 || forcedMask > 7)) {
    return fail('bad-input', 'qr: mask must be an integer 0..7');
  }

  const wanted = opts.mode ?? 'auto';
  if (wanted !== 'auto' && wanted !== 'byte' && wanted !== 'alphanumeric') {
    return fail('bad-input', 'qr: mode must be auto, byte or alphanumeric');
  }
  if (wanted === 'alphanumeric' && !isAlphanumeric(text)) {
    return fail('bad-input', 'qr: text has characters outside the alphanumeric set');
  }
  const mode: QrMode = wanted === 'auto' ? (isAlphanumeric(text) ? 'alphanumeric' : 'byte') : wanted;
  const bytes = mode === 'byte' ? textEncoder.encode(text) : new Uint8Array(0);

  const dataBits = payloadBits(mode, text, bytes);
  let version = 0;
  for (let v = minVersion; v <= maxVersion; v++) {
    if (4 + countBits(v, mode) + dataBits <= dataCodewords(v) * 8) {
      version = v;
      break;
    }
  }
  if (version === 0) {
    const cap = qrCapacity(maxVersion, mode);
    const have = mode === 'byte' ? bytes.length : text.length;
    return fail(
      'too-large',
      `qr: ${have} ${mode === 'byte' ? 'bytes' : 'characters'} exceed the ${cap} that fit version ${maxVersion} at level ${QR_EC_LEVEL}`,
    );
  }

  const capacityBits = dataCodewords(version) * 8;
  const bits: number[] = [];
  appendBits(bits, MODE_INDICATOR[mode], 4);
  appendBits(bits, mode === 'byte' ? bytes.length : text.length, countBits(version, mode));
  writePayload(bits, mode, text, bytes);
  const codewords = addEccAndInterleave(version, toDataCodewords(bits, capacityBits));

  const size = version * 4 + 17;
  const g: Grid = { size, dark: new Uint8Array(size * size), fn: new Uint8Array(size * size) };
  drawFunctionPatterns(g, version);
  drawCodewords(g, codewords);

  let mask = forcedMask ?? 0;
  if (forcedMask === undefined) {
    let best = Number.POSITIVE_INFINITY;
    for (let m = 0; m < 8; m++) {
      applyMask(g, m);
      drawFormat(g, m);
      const score = penalty(g);
      if (score < best) {
        best = score;
        mask = m;
      }
      applyMask(g, m); // XOR is self-inverse - put the unmasked data back
    }
  }
  applyMask(g, mask);
  drawFormat(g, mask);

  return { ok: true, value: { version, size, mask, mode, modules: g.dark } };
}

// ── SVG ───────────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Symbol → SVG. One `<path>` of horizontal runs rather than a rect per module: a
 * version-9 symbol is ~2,800 dark modules, and the run-merged path is roughly a
 * quarter the bytes with identical geometry. `shape-rendering="crispEdges"` is what
 * keeps module boundaries from anti-aliasing into grey at fractional scales, which is
 * exactly the blur a camera struggles with.
 */
export function toSvg(symbol: QrSymbol, opts: QrSvgOptions = {}): string {
  const margin = Math.max(0, Math.floor(opts.margin ?? QR_QUIET_ZONE));
  const dark = opts.dark ?? 'currentColor';
  const light = opts.light === undefined ? '#fff' : opts.light;
  const colour = opts.color ?? '#000';
  const span = symbol.size + margin * 2;

  const runs: string[] = [];
  for (let y = 0; y < symbol.size; y++) {
    let x = 0;
    while (x < symbol.size) {
      if (symbol.modules[y * symbol.size + x] !== 1) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < symbol.size && symbol.modules[y * symbol.size + x + run] === 1) run++;
      runs.push(`M${x + margin} ${y + margin}h${run}v1h-${run}z`);
      x += run;
    }
  }

  const dims = opts.pixelSize === undefined
    ? 'width="100%" height="100%"'
    : `width="${opts.pixelSize}" height="${opts.pixelSize}"`;
  const a11y = opts.label === undefined
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapeXml(opts.label)}"`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" ${dims} ` +
      `color="${escapeXml(colour)}" shape-rendering="crispEdges" ${a11y}>`,
  );
  if (opts.label !== undefined) parts.push(`<title>${escapeXml(opts.label)}</title>`);
  if (light !== null) parts.push(`<rect width="${span}" height="${span}" fill="${escapeXml(light)}"/>`);
  parts.push(`<path fill="${escapeXml(dark)}" d="${runs.join('')}"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/** Text → SVG, typed-failure flavour. */
export function renderQrSvg(text: string, opts: QrEncodeOptions & QrSvgOptions = {}): QrResult<string> {
  const symbol = encodeQr(text, opts);
  if (!symbol.ok) return symbol;
  return { ok: true, value: toSvg(symbol.value, opts) };
}

/**
 * The `opts.renderQr` shape the ceremony dialog documents (section 6.1): text in, SVG out.
 * Throws {@link QrRenderError} - the only throwing export in this module - because the
 * callback signature has nowhere to put a failure. Callers that would rather branch
 * than catch should use {@link renderQrSvg}; either way an over-capacity payload means
 * "show the paste path", not "show a broken image".
 */
export function renderQr(text: string, opts: QrEncodeOptions & QrSvgOptions = {}): string {
  const svg = renderQrSvg(text, opts);
  if (!svg.ok) throw new QrRenderError(svg);
  return svg.value;
}

/** Bind options once and hand the dialog a plain `(text) => svg`. Throws like {@link renderQr}. */
export function createQrRenderer(opts: QrEncodeOptions & QrSvgOptions = {}): (text: string) => string {
  return (text: string) => renderQr(text, opts);
}

export interface QrElementOptions extends QrEncodeOptions, QrSvgOptions {
  /** Widest the symbol is allowed to draw, in CSS px. Default 260. */
  readonly maxWidthPx?: number;
  /** Element factory. Defaults to the ambient `document`; injected in tests. */
  readonly doc?: { createElement(tagName: string): HTMLElement };
}

/**
 * The shape `components/collab-ceremony.ts` asks for: `(text) => HTMLElement | null`.
 *
 * Two deliberate choices. It returns a **wrapping `<div>`**, not the `<svg>` - an
 * `<svg>` is an `SVGElement`, not an `HTMLElement`, and the wrapper is also where the
 * sizing lives, so the caller's slot needs no stylesheet of its own. And it returns
 * **null instead of throwing** on a payload that will not fit or a shell with no
 * document: the dialog treats a missing QR as "this skin is not on offer" and the token
 * printed above it is the real payload, so degrading is the correct behaviour, not a
 * swallowed error.
 *
 * The `<svg>` is sized `width:100%; height:auto` against the wrapper's `max-width`,
 * which is the only combination that behaves in every engine - a percentage HEIGHT
 * inside an auto-height parent is the aspect-ratio trap this codebase has been bitten
 * by before.
 */
export function createQrElementRenderer(
  opts: QrElementOptions = {},
): (text: string) => HTMLElement | null {
  return (text: string) => {
    const host = opts.doc ?? (typeof document === 'undefined' ? null : document);
    if (!host) return null;
    const svg = renderQrSvg(text, opts);
    if (!svg.ok) return null;
    const raw = opts.maxWidthPx ?? 260;
    const max = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 260;
    const box = host.createElement('div');
    box.className = 'qr-skin';
    box.setAttribute('style', `display:block;width:100%;max-width:${max}px;margin:0 auto`);
    // The markup is this module's own output and every interpolated option is
    // XML-escaped by `toSvg`, so there is no untrusted string in this assignment.
    box.innerHTML = svg.value;
    box.firstElementChild?.setAttribute('style', 'display:block;width:100%;height:auto');
    return box;
  };
}

// ── Scan (section 11.27) ─────────────────────────────────────────────────────────────

/** The slice of `BarcodeDetector` this module uses, typed structurally - the DOM lib has none. */
interface BarcodeDetectorLike {
  detect(source: unknown): Promise<readonly { readonly rawValue?: unknown }[]>;
}

interface BarcodeDetectorCtor {
  new (init?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

export type QrScanUnsupportedReason =
  /** No `BarcodeDetector` at all - Safari, Firefox, older Chromium. */
  | 'no-api'
  /** The API exists but the platform's backend does not decode QR (some Linux builds). */
  | 'no-qr-format'
  /** It exists, and asking it anything threw. Treat exactly like absent. */
  | 'probe-failed';

export interface QrScanCapability {
  readonly supported: boolean;
  /** What the platform reported, when it reported anything. */
  readonly formats: readonly string[];
  /** Absent when `supported`. The dialog maps this to its own (i18n'd) copy. */
  readonly reason?: QrScanUnsupportedReason;
  /** Diagnostic for logs, never user copy. */
  readonly detail?: string;
}

const QR_FORMAT = 'qr_code';

let probeCache: Promise<QrScanCapability> | null = null;

function readCtor(scope: object | undefined): BarcodeDetectorCtor | null {
  const bag = (scope ?? globalThis) as { BarcodeDetector?: unknown };
  const ctor = bag.BarcodeDetector;
  return typeof ctor === 'function' ? (ctor as BarcodeDetectorCtor) : null;
}

export interface QrProbeOptions {
  /** Where to look for the global. Tests pass a stub; production passes nothing. */
  readonly scope?: object;
  /** Re-run instead of reusing the cached answer. */
  readonly force?: boolean;
}

/**
 * Can this browser scan a QR code? Cached, because the answer cannot change inside a
 * page load and the dialog asks on every open.
 *
 * The check is deliberately three-legged. A constructor alone is not support: Chromium
 * on a platform with no barcode backend exposes the API and reports ZERO formats, and a
 * dialog that trusted `'BarcodeDetector' in window` would put a camera in front of a
 * user and then never decode anything. Where the static `getSupportedFormats` is
 * missing entirely (a polyfill, an older build) the fallback is to construct the
 * detector asking for QR and believe a success - the strictest thing we can do without
 * refusing a scanner that actually works.
 */
export function probeBarcodeDetector(opts: QrProbeOptions = {}): Promise<QrScanCapability> {
  const usingGlobal = opts.scope === undefined;
  if (usingGlobal && !opts.force && probeCache) return probeCache;

  const run = async (): Promise<QrScanCapability> => {
    const ctor = readCtor(opts.scope);
    if (!ctor) return { supported: false, formats: [], reason: 'no-api' };
    try {
      if (typeof ctor.getSupportedFormats === 'function') {
        const formats = await ctor.getSupportedFormats();
        const list = Array.isArray(formats) ? formats.filter((f): f is string => typeof f === 'string') : [];
        if (!list.includes(QR_FORMAT)) {
          return { supported: false, formats: list, reason: 'no-qr-format' };
        }
        // Constructing is cheap and is the only way to learn that a listed format
        // still refuses to instantiate.
        new ctor({ formats: [QR_FORMAT] });
        return { supported: true, formats: list };
      }
      new ctor({ formats: [QR_FORMAT] });
      return { supported: true, formats: [QR_FORMAT] };
    } catch (err) {
      return {
        supported: false,
        formats: [],
        reason: 'probe-failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  };

  const promise = run();
  if (usingGlobal) probeCache = promise;
  return promise;
}

/** Drop the cached probe. Tests only - the answer is stable within a page load. */
export function resetQrScanProbe(): void {
  probeCache = null;
}

/** The parts of `HTMLVideoElement` the scan loop reads; a fake satisfies it structurally. */
export interface QrVideoLike {
  readonly readyState: number;
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export interface QrScanOptions {
  /** Abort the scan (dialog closed, step cancelled). Resolves `null`, never rejects. */
  readonly signal?: AbortSignal;
  /** Poll period. Default 200 ms ≈ 5 Hz - enough for a held-still code, cheap enough
   *  to leave the camera preview smooth. */
  readonly intervalMs?: number;
  /** Where to find `BarcodeDetector`. Tests pass a stub. */
  readonly scope?: object;
  /**
   * Keep scanning until a decoded value passes. The ceremony uses this so an unrelated
   * QR wandering through frame (a poster, a business card) cannot end the step with a
   * value the codec will only reject afterwards.
   */
  readonly accept?: (value: string) => boolean;
  /** Called for each `detect()` rejection. Diagnostics only; the loop keeps going. */
  readonly onError?: (err: unknown) => void;
}

/**
 * How many consecutive `detect()` rejections end the scan. A detector that throws once
 * is a frame we skip; one that throws every time is broken, and spinning a camera
 * against it forever is worse than falling back to paste.
 */
const MAX_CONSECUTIVE_DETECT_FAILURES = 8;

/** `HAVE_CURRENT_DATA` - below this there is no frame to read. */
const VIDEO_HAVE_CURRENT_DATA = 2;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>(resolve => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const done = (): void => {
      if (handle !== undefined) clearTimeout(handle);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    handle = setTimeout(done, Math.max(0, ms));
    if (signal) {
      if (signal.aborted) done();
      else signal.addEventListener('abort', done, { once: true });
    }
  });
}

/**
 * One decode attempt against any `ImageBitmapSource` (a `<video>`, a canvas, a blob-
 * backed `ImageBitmap`). Resolves the first accepted `rawValue`, or `null`. Rejections
 * from `detect()` propagate - the polling loop above is what decides they are survivable.
 */
async function detectOnce(
  detector: BarcodeDetectorLike,
  source: unknown,
  accept?: (value: string) => boolean,
): Promise<string | null> {
  const found = await detector.detect(source);
  if (!Array.isArray(found)) return null;
  for (const item of found) {
    const value = item?.rawValue;
    if (typeof value !== 'string' || value.length === 0) continue;
    if (accept && !accept(value)) continue;
    return value;
  }
  return null;
}

/**
 * Poll a playing `<video>` until a QR decodes, the signal aborts, or the detector gives
 * up. Resolves the decoded string or `null` - it never rejects and never throws, because
 * the caller is a dialog step whose alternative path (paste) must always stay reachable.
 *
 * The camera is NOT this function's business: the caller owns `getUserMedia`, the
 * element, and stopping every track afterwards (see `bridge/media.ts` for the shell's
 * idiom). Scanning without support resolves `null` immediately rather than pretending - 
 * probe first, and lead with paste when the answer is no.
 */
export async function scanQrFromVideo(video: QrVideoLike, opts: QrScanOptions = {}): Promise<string | null> {
  const capability = await probeBarcodeDetector({ scope: opts.scope });
  if (!capability.supported) return null;
  const ctor = readCtor(opts.scope);
  if (!ctor) return null;

  let detector: BarcodeDetectorLike;
  try {
    detector = new ctor({ formats: [QR_FORMAT] });
  } catch (err) {
    opts.onError?.(err);
    return null;
  }

  const interval = opts.intervalMs ?? 200;
  let failures = 0;
  for (;;) {
    if (opts.signal?.aborted) return null;
    // A video that has not decoded a frame yet is not a failure, just not ready.
    if (video && video.readyState >= VIDEO_HAVE_CURRENT_DATA && video.videoWidth > 0) {
      try {
        const value = await detectOnce(detector, video, opts.accept);
        // Checked BEFORE the value is returned, not after: an abort that lands while
        // `detect()` is in flight must still resolve `null`, or a dialog that has
        // already closed receives a token nobody is waiting for.
        if (opts.signal?.aborted) return null;
        failures = 0;
        if (value !== null) return value;
      } catch (err) {
        opts.onError?.(err);
        failures++;
        if (failures >= MAX_CONSECUTIVE_DETECT_FAILURES) return null;
      }
      if (opts.signal?.aborted) return null;
    }
    await sleep(interval, opts.signal);
  }
}

/**
 * Bind a video element once and hand the ceremony dialog its `opts.scan`: the returned
 * function takes an optional `{ signal }`, so it also satisfies the no-argument
 * `() => Promise<string | null>` the dialog declares - bind the dialog's own abort
 * signal here and a closed dialog stops the poll loop even though `scan()` is called
 * with nothing.
 *
 * The whole wiring, in one place so nobody invents a second camera story. The dialog
 * exposes no abort signal of its own, so the caller owns one and fires it from
 * `onClose` - which is also what stops the poll loop when the ceremony is cancelled
 * mid-scan:
 *
 * ```ts
 * const cap = await probeBarcodeDetector();
 * const scanning = new AbortController();
 * openCollabCeremony({
 *   role: 'acceptor',
 *   effects: transportBundle,
 *   renderQr: createQrElementRenderer(),
 *   // Absent `scan` is what makes the dialog hide the option entirely (section 11.27).
 *   scan: cap.supported ? async () => {
 *     const stream = await navigator.mediaDevices.getUserMedia({
 *       video: { facingMode: 'environment' }, audio: false,
 *     });
 *     const video = document.createElement('video');
 *     video.playsInline = true; video.muted = true; video.srcObject = stream;
 *     void video.play();
 *     showPreview(video);           // scanning blind is not scanning
 *     try {
 *       return await scanQrFromVideo(video, { signal: scanning.signal });
 *     } finally {
 *       for (const t of stream.getTracks()) t.stop();   // always, on every exit
 *     }
 *   } : undefined,
 *   onClose: () => scanning.abort(),
 * });
 * ```
 */
export function createQrScanner(
  video: QrVideoLike,
  base: QrScanOptions = {},
): (opts?: { signal?: AbortSignal }) => Promise<string | null> {
  return (opts) => scanQrFromVideo(video, { ...base, signal: opts?.signal ?? base.signal });
}
