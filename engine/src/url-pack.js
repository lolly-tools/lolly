// SPDX-License-Identifier: MPL-2.0
/**
 * Packed URL state — the compact transport for large tool state.
 *
 * URL mode (url-mode.js) is first-class and deliberately human-readable: a simple
 * tool link like `?color=30BA78&theme=dark` can be hand-edited. But a complex tool
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
 *      serialization url-mode.js already produces. There is NO new value-encoding
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
// url-mode.js's RESERVED set so a stray `z` is never mistaken for a tool input.
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
function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- raw DEFLATE via Web Streams (native, zero-dep) -------------------------
async function deflateRaw(bytes) {
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
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks = [];
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
export function isPackAvailable() {
  return typeof CompressionStream === 'function'
    && typeof DecompressionStream === 'function'
    && typeof Response === 'function'
    && typeof btoa === 'function'
    && typeof atob === 'function';
}

/** True if `query` carries a packed state param. Cheap; no decode. */
export function hasPackedState(query) {
  if (!query) return false;
  return new URLSearchParams(query).has(PACK_PARAM);
}

/**
 * Pack a query string into a `z` token (`<tag><base64url>`). Returns null when the
 * codec is unavailable so callers fall back to the readable form. Does NOT decide
 * whether packing is worthwhile — the caller compares lengths (packing LOSES on
 * short inputs: DEFLATE framing + base64's 4/3 blowup exceed tiny payloads).
 * @param {string} query  a `&`-joined query string (no leading `?`)
 * @returns {Promise<string|null>}
 */
export async function packQuery(query) {
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
 * @param {string} token  the raw `z` value (`<tag><base64url>`)
 * @returns {Promise<string|null>}
 */
export async function unpackToken(token) {
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
 * @param {string} query
 * @returns {Promise<string>}
 */
export async function expandQuery(query) {
  if (!query) return query;
  const sp = new URLSearchParams(query);
  const token = sp.get(PACK_PARAM);
  if (token == null) return query;

  const decoded = await unpackToken(token);
  if (decoded == null) return query;   // corrupt/unknown → leave as-is (reserved, ignored)

  // Re-emit every non-`z` param after the decoded base. These are simple flag
  // params (no compact-block payloads), so re-encoding them is lossless; the heavy
  // state lives entirely in `decoded`, which is spliced in verbatim.
  const extras = [];
  for (const [k, v] of sp.entries()) {
    if (k === PACK_PARAM) continue;
    extras.push(v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return extras.length ? `${decoded}&${extras.join('&')}` : decoded;
}
