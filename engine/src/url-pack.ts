// SPDX-License-Identifier: MPL-2.0
/**
 * Packed URL state — the compact transport for large tool state.
 *
 * URL mode (url-mode.ts) is first-class and deliberately human-readable: a simple
 * tool link like `?color=336699&theme=dark` can be hand-edited. But a complex tool
 * (Layout Studio, with dozens of boxes carrying coords / colours / text) serialises
 * to thousands of characters — past the ~2000-char ceiling that pasted links, social
 * crawlers, QR codes and some servers still enforce.
 *
 * This module packs the ENTIRE readable query string into a single `z` param:
 *
 *   /t/layout-studio?background=…&boxes=…&format=png      (readable, 2729 chars)
 *   /t/layout-studio?z=1eJyFkc…                           (packed,   1059 chars)
 *
 * Design decisions that make this SAFE and STABLE:
 *
 *   1. We compress the app's OWN canonical query string — the exact same readable
 *      serialization url-mode.ts already produces. There is NO new value-encoding
 *      surface to keep in sync: packed stability reduces to (already-frozen) readable
 *      stability + the DEFLATE standard.
 *
 *   2. The codec is raw DEFLATE (a frozen IETF standard, RFC 1951) via the platform
 *      -native `CompressionStream`/`DecompressionStream` — ZERO new dependencies, and
 *      present in every target (modern browsers, Node 18+, the jsdom CLI, Deno). We
 *      never compare packed *bytes* for equality — only that decode(encode(x)) === x,
 *      which the standard guarantees across engines and versions (a link packed in a
 *      browser decodes byte-identically in Node's zlib and vice versa). So there is no
 *      app-side dictionary that could drift and silently break an old shared link;
 *      LZ77's per-URL sliding window is the "shared index of repeated values", rebuilt
 *      self-contained inside every link.
 *
 *   3. The value is `<tag><base64url>`. The one-char `tag` versions the codec so a
 *      future variant (e.g. a frozen domain dictionary) can be added WITHOUT breaking
 *      links minted today: old tags keep their frozen decoders forever. Tag `1` =
 *      raw DEFLATE, no dictionary. base64url keeps the whole value URL-safe (no `%`
 *      escaping, no `=` padding) so it never needs re-encoding.
 *
 * Pure and DOM-free. Async because the Web Streams codec is async; the sync
 * `parseUrlState` is unchanged — callers run `expandQuery` first, at the (already
 * async) load boundary.
 */

// The single reserved query param that carries a whole packed state. Mirrored in
// url-mode.ts's RESERVED set so a stray `z` is never mistaken for a tool input.
import { asBufferSource } from './bytes.ts';

export const PACK_PARAM = 'z';

// Codec tag (first char of the `z` value). '1' = raw DEFLATE, no dictionary.
// Never reuse a tag for a different codec — old links must decode forever.
const TAG_DEFLATE_RAW = '1';

// Bounds that defang a hostile link. A `z` token is decoded from an untrusted URL,
// and DEFLATE can expand ~1000×, so cap BOTH the token we accept and the bytes we
// inflate — a decompression bomb must not hang the tab. Both sit far above any real
// state (even a huge multi-hundred-box layout readable-serialises to a few tens of KB).
const MAX_TOKEN = 64 * 1024;      // reject an absurdly long z value before decoding
const MAX_UNPACKED = 256 * 1024;  // abort inflation past this many output bytes

// --- base64url <-> bytes (URL-safe, unpadded) -------------------------------
// btoa/atob are globals in browsers and Node 18+. Values are ≤ a few KB, so the
// per-char binary-string bridge is fine.
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- raw DEFLATE via Web Streams (native, zero-dep) -------------------------
async function deflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

// Inflate with a hard output-size cap. Reading chunk-by-chunk lets Web Streams
// backpressure hold the decompressor between pulls, so a bomb is stopped at ~cap
// instead of allocating its full expansion first. Cancelling the reader mid-stream
// rejects the writable side we fed above, so those promises are explicitly caught —
// otherwise the abort surfaces as an unhandled rejection.
async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UNPACKED) throw new Error('url-pack: decompressed size exceeds cap');
      chunks.push(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/**
 * True when this environment can pack/unpack (the Web Streams codec + base64 +
 * Response are all present). A shell without them simply keeps readable URLs —
 * packing is a progressive enhancement, never a hard dependency.
 */
export function isPackAvailable(): boolean {
  return typeof CompressionStream === 'function'
    && typeof DecompressionStream === 'function'
    && typeof Response === 'function'
    && typeof btoa === 'function'
    && typeof atob === 'function';
}

/** True if `query` carries a packed state param. Cheap; no decode. */
export function hasPackedState(query: string | null | undefined): boolean {
  if (!query) return false;
  return new URLSearchParams(query).has(PACK_PARAM);
}

/**
 * Pack a query string into a `z` token (`<tag><base64url>`). Returns null when the
 * codec is unavailable so callers fall back to the readable form. Does NOT decide
 * whether packing is worthwhile — the caller compares lengths (packing LOSES on
 * short inputs: DEFLATE framing + base64's 4/3 blowup exceed tiny payloads).
 * @param query  a `&`-joined query string (no leading `?`)
 */
export async function packQuery(query: string | null | undefined): Promise<string | null> {
  if (!isPackAvailable() || query == null) return null;
  try {
    const bytes = new TextEncoder().encode(String(query));
    // Refuse to mint a token the decoder would then refuse. The encode and decode
    // size limits MUST stay symmetric: unpackToken caps its output at MAX_UNPACKED
    // and the token at MAX_TOKEN, so a token that trips either cap is one we could
    // never reopen — a silent, unrecoverable break of decode(encode(x)) === x. When
    // that happens the caller falls back to the readable URL, which round-trips
    // unpacked (expandQuery is a no-op without a `z`).
    if (bytes.length > MAX_UNPACKED) return null;
    const token = TAG_DEFLATE_RAW + bytesToBase64Url(await deflateRaw(bytes));
    return token.length > MAX_TOKEN ? null : token;
  } catch {
    return null;
  }
}

/**
 * Decode a `z` token back into the original query string. Returns null for an
 * unknown tag, corruption, or an unavailable codec (a hand-mangled or truncated
 * link can't be recovered — better null than fabricated state).
 * @param token  the raw `z` value (`<tag><base64url>`)
 */
export async function unpackToken(token: string): Promise<string | null> {
  if (!isPackAvailable() || typeof token !== 'string' || token.length < 2 || token.length > MAX_TOKEN) return null;
  const tag = token[0];
  if (tag !== TAG_DEFLATE_RAW) return null;
  try {
    const bytes = base64UrlToBytes(token.slice(1));
    return new TextDecoder().decode(await inflateRaw(bytes));
  } catch {
    return null;
  }
}

// --- Encrypted links (`zx`) -------------------------------------------------
// A password-gated variant of the packed link: the SAME readable query is DEFLATE'd
// then AES-256-GCM-encrypted under a key derived from a password (PBKDF2-SHA256). The
// link carries ONLY ciphertext (+ salt / iv / iteration count) in a separate `zx`
// param — the PASSWORD NEVER TRAVELS. Opening such a link prompts for the password
// client-side (no server) and decrypts to the readable query: the secure counterpart
// to the clear-text `?password=` PDF flag. Deliberately NOT handled inside
// expandQuery — only the interactive load boundary (which can prompt) decrypts it;
// the headless embed / renderUrl path leaves `zx` untouched (reserved → ignored →
// renders at defaults), so an encrypted link simply can't be embedded-as-image.
export const ENC_PARAM = 'zx';
const TAG_PBKDF2_AESGCM = '1';    // first char of the `zx` value; versions this codec
const PBKDF2_ITERATIONS = 210_000; // OWASP-2023 PBKDF2-SHA256 floor; stored per-token so it can rise later
const ENC_SALT_BYTES = 16;
const ENC_IV_BYTES = 12;          // AES-GCM standard nonce
const ENC_HEADER = 4 + ENC_SALT_BYTES + ENC_IV_BYTES; // iterations(u32 BE) ‖ salt ‖ iv

/** True when encrypted links are possible here (packing codec + WebCrypto subtle). */
export function isEncryptAvailable(): boolean {
  return isPackAvailable() && typeof globalThis.crypto?.subtle !== 'undefined';
}

/** True if `query` carries an encrypted state param. Cheap; no decode. */
export function hasEncryptedState(query: string | null | undefined): boolean {
  if (!query) return false;
  return new URLSearchParams(query).has(ENC_PARAM);
}

async function deriveLinkKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await globalThis.crypto.subtle.importKey(
    'raw', asBufferSource(new TextEncoder().encode(password)), 'PBKDF2', false, ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/**
 * Pack a query into an ENCRYPTED `zx` token (`<tag><base64url(iter‖salt‖iv‖ct)>`),
 * or null if the codec is unavailable / no password / too large. The password only
 * derives the key — it is never stored in the token.
 * @param query  a `&`-joined query string (no leading `?`)
 */
export async function packEncrypted(query: string | null | undefined, password: string): Promise<string | null> {
  if (!isEncryptAvailable() || query == null || !password) return null;
  try {
    const bytes = new TextEncoder().encode(String(query));
    // Cap the UNCOMPRESSED length, symmetric with the inflate cap on decode
    // (unpackEncrypted → inflateRaw aborts past MAX_UNPACKED). Checking the
    // compressed length instead would mint tokens that can never be decrypted.
    if (bytes.length > MAX_UNPACKED) return null;
    const compressed = await deflateRaw(bytes);
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(ENC_SALT_BYTES));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(ENC_IV_BYTES));
    const key = await deriveLinkKey(password, salt, PBKDF2_ITERATIONS);
    const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) }, key, asBufferSource(compressed),
    ));
    const blob = new Uint8Array(ENC_HEADER + ct.length);
    new DataView(blob.buffer).setUint32(0, PBKDF2_ITERATIONS, false); // big-endian
    blob.set(salt, 4);
    blob.set(iv, 4 + ENC_SALT_BYTES);
    blob.set(ct, ENC_HEADER);
    const token = TAG_PBKDF2_AESGCM + bytesToBase64Url(blob);
    return token.length > MAX_TOKEN ? null : token;
  } catch {
    return null;
  }
}

/**
 * Decode a `zx` token with the given password. Returns null on WRONG PASSWORD
 * (AES-GCM authentication fails), tamper, an unknown tag, or an unavailable codec —
 * never fabricated state. Same size caps as unpackToken.
 * @param token  the raw `zx` value (`<tag><base64url>`)
 */
export async function unpackEncrypted(token: string, password: string): Promise<string | null> {
  if (!isEncryptAvailable() || typeof token !== 'string' || token.length < 2 || token.length > MAX_TOKEN || !password) return null;
  if (token[0] !== TAG_PBKDF2_AESGCM) return null;
  try {
    const blob = base64UrlToBytes(token.slice(1));
    if (blob.length < ENC_HEADER + 16) return null;   // + 16-byte GCM tag minimum
    const iterations = new DataView(blob.buffer, blob.byteOffset, 4).getUint32(0, false);
    if (iterations < 1 || iterations > 10_000_000) return null;   // sanity-bound the work factor
    const salt = blob.subarray(4, 4 + ENC_SALT_BYTES);
    const iv = blob.subarray(4 + ENC_SALT_BYTES, ENC_HEADER);
    const ct = blob.subarray(ENC_HEADER);
    const key = await deriveLinkKey(password, salt, iterations);
    const compressed = new Uint8Array(await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) }, key, asBufferSource(ct),
    ));
    return new TextDecoder().decode(await inflateRaw(compressed));
  } catch {
    return null;   // wrong password / tampered / corrupt
  }
}

/**
 * Expand a possibly-packed query string into a plain one the sync parser reads.
 *
 * With no `z` param this is a no-op (returns the input). With a `z` param, the
 * decoded query is the BASE state, used verbatim so its exact block encoding
 * (`~`/`,` delimiters) is preserved untouched — and any OTHER params riding
 * alongside `z` are appended AFTER it, so they override (parseUrlState is
 * last-wins for inputs) and readable on-visit flags (`export`, `full`, `_v`, …)
 * still take effect. A `z` that fails to decode is left in place (it is reserved,
 * so the parser ignores it) and the tool loads at its defaults.
 *
 * Run this at the load boundary BEFORE parseUrlState. Idempotent on unpacked input.
 */
export async function expandQuery(query: string): Promise<string> {
  if (!query) return query;
  const sp = new URLSearchParams(query);
  const token = sp.get(PACK_PARAM);
  if (token == null) return query;

  const decoded = await unpackToken(token);
  if (decoded == null) return query;   // corrupt/unknown → leave as-is (reserved, ignored)

  // Re-emit every non-`z` param after the decoded base. These are simple flag
  // params (no compact-block payloads), so re-encoding them is lossless; the heavy
  // state lives entirely in `decoded`, which is spliced in verbatim.
  const extras: string[] = [];
  sp.forEach((v, k) => {
    if (k === PACK_PARAM) return;
    extras.push(v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return extras.length ? `${decoded}&${extras.join('&')}` : decoded;
}
