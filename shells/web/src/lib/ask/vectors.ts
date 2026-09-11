// SPDX-License-Identifier: MPL-2.0
/**
 * The committed semantic vectors for Ask (plans/103 M1) - parse, cosine, load.
 *
 * The docs corpus is public and static, so its embeddings are precomputed at
 * build time (scripts/build-ask-vectors.ts) and COMMITTED as two /info artifacts
 * rather than embedded on the client: CI and Vercel never need the model, and a
 * cold visitor pays ~245 KB instead of ~23 MB to get semantic ranking of the
 * corpus (only the QUERY needs the model, and that stays behind consent).
 *
 * `ask-vectors.bin` is little-endian and laid out as:
 *
 *     offset  bytes          field
 *     0       8              magic, the ASCII letters LOLLYVEC
 *     8       4              u32 version (1)
 *     12      4              u32 count   (rows == search-index records)
 *     16      4              u32 dim     (384 for all-MiniLM-L6-v2)
 *     20      4              u32 reserved (0)
 *     24      4 * count      f32 per-row scale = max|v| of the normalised row
 *     24+4c   count * dim    i8  rows, row-major, round(v / scale * 127)
 *
 * Rows stay i8 in memory - a Int8Array VIEW straight onto the fetched buffer,
 * never expanded to f32. At 646 x 384 that is 248 KB held instead of 992 KB, and
 * the dequantisation is one multiply per row at the end of its dot product.
 *
 * Every row was L2-normalised BEFORE quantisation, and the query embedding is
 * L2-normalised too, so the dot product IS the cosine up to quantisation error
 * (measured at <= 0.02 in vectors.test.ts, which is far below the gap the hybrid
 * blend in retrieve.ts cares about).
 *
 * Nothing here touches the DOM, and the only fetch is the thin `loadVectors()`
 * at the bottom - the parsing and the maths are pure, so the same code answers
 * for the browser, a Node test, and (should it ever need to) a build script.
 */
import { currentLang, type Lang } from '../../i18n.ts';
import { docsBase, loadDocsIndex, type DocsRecord } from '../search/docs-index.ts';

/** The 8 ASCII bytes every ask-vectors.bin opens with. */
const MAGIC = 'LOLLYVEC';
/** magic(8) + version + count + dim + reserved, all u32 little-endian. */
const HEADER_BYTES = 24;
/** The only container version this build understands. */
const VECTORS_VERSION = 1;
/** int8 full scale - the quantiser's divisor, so the dequantiser's too. */
const Q_SCALE = 127;

/**
 * A parsed ask-vectors.bin, kept in its wire shape (i8 rows + per-row f32
 * scales) so cosine can run over it without a f32 copy of the whole matrix.
 * Row `i` corresponds to record `i` of the docs search index - the build script
 * keeps the positions DENSE (a record whose section could not be aligned embeds
 * its 240-char snippet instead), so a cosine hit's `index` indexes the index.
 */
export interface QuantisedVectors {
  /** Container version from the header (1 today). */
  version: number;
  /** Number of rows, one per docs-index record. */
  count: number;
  /** Components per row (384 for all-MiniLM-L6-v2). */
  dim: number;
  /** Per-row dequantisation scale, `count` long. */
  scales: Float32Array;
  /** `count * dim` int8 components, row-major - a view on the source buffer. */
  rows: Int8Array;
}

/** One ranked row: its position in the docs index and its cosine to the query. */
export interface CosineHit { index: number; cos: number }

/**
 * Parse and fully validate an ask-vectors.bin. Throws on anything unexpected -
 * bad magic, an unknown version, a non-zero reserved word, a degenerate header
 * or a length that is not EXACTLY the header plus the two declared blocks. The
 * only caller that matters (`loadVectors`) turns any throw into a null, i.e.
 * lexical-only retrieval, so being strict here costs nothing at runtime and
 * catches a truncated or half-written artifact at the door.
 */
export function parseVectorsBin(buf: ArrayBuffer): QuantisedVectors {
  if (buf.byteLength < HEADER_BYTES) throw new Error(`ask-vectors: ${buf.byteLength} bytes is shorter than the ${HEADER_BYTES}-byte header`);
  const dv = new DataView(buf);
  for (let i = 0; i < MAGIC.length; i++) {
    if (dv.getUint8(i) !== MAGIC.charCodeAt(i)) throw new Error('ask-vectors: bad magic (not a LOLLYVEC file)');
  }
  const version = dv.getUint32(8, true);
  if (version !== VECTORS_VERSION) throw new Error(`ask-vectors: unsupported version ${version}`);
  const count = dv.getUint32(12, true);
  const dim = dv.getUint32(16, true);
  const reserved = dv.getUint32(20, true);
  // Reserved is where a future writer would put a flag, and a flag we cannot
  // read changes what the bytes mean - that is a version bump, not a silent
  // reinterpretation.
  if (reserved !== 0) throw new Error(`ask-vectors: reserved header word must be 0, got ${reserved}`);
  if (count < 1 || dim < 1) throw new Error(`ask-vectors: degenerate header (count ${count}, dim ${dim})`);

  const expected = HEADER_BYTES + 4 * count + count * dim;
  if (buf.byteLength !== expected) throw new Error(`ask-vectors: length ${buf.byteLength} != expected ${expected} for count ${count} dim ${dim}`);

  // The scales are read through the DataView, not viewed as a Float32Array: a
  // typed-array view reads in PLATFORM byte order, and the format is defined as
  // little-endian. `count` reads is nothing next to the dot products. The i8
  // rows are single bytes, so those can be a zero-copy view.
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const s = dv.getFloat32(HEADER_BYTES + i * 4, true);
    if (!Number.isFinite(s) || s < 0) throw new Error(`ask-vectors: row ${i} has a non-finite or negative scale`);
    scales[i] = s;
  }
  const rows = new Int8Array(buf, HEADER_BYTES + count * 4, count * dim);
  return { version, count, dim, scales, rows };
}

/**
 * The `k` rows closest to a query embedding, best first.
 *
 * `query` must be the L2-normalised f32 embedding of the question, `dim` long -
 * a length mismatch returns nothing rather than scoring garbage (the caller
 * falls back to lexical). Each row dequantises as `i8 / 127 * scale`, and the
 * row's scale is a constant across its components, so it multiplies the whole
 * dot product once at the end instead of once per component.
 *
 * Selection is a bounded insertion into a `k`-long list, so a corpus of any size
 * costs one pass and no full sort. Ties keep the earlier row first.
 */
export function cosineTopK(query: Float32Array, vecs: QuantisedVectors, k: number): CosineHit[] {
  const { count, dim, rows, scales } = vecs;
  if (k < 1 || query.length !== dim) return [];
  const top: CosineHit[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * dim;
    let dot = 0;
    for (let j = 0; j < dim; j++) dot += query[j]! * rows[base + j]!;
    const cos = (dot * scales[i]!) / Q_SCALE;
    if (top.length >= k && cos <= top[top.length - 1]!.cos) continue;
    let pos = top.length;
    while (pos > 0 && top[pos - 1]!.cos < cos) pos--;
    top.splice(pos, 0, { index: i, cos });
    if (top.length > k) top.pop();
  }
  return top;
}

/** The companion ask-vectors.json, as far as the runtime cares. The build script
 *  writes more (model, upstream, dtype, corpusHash, builtAt); those are for
 *  humans and the staleness guard, not for this load path. */
interface VectorsManifest { v?: unknown; dim?: unknown; count?: unknown; recordsHash?: unknown }

/** Lowercase hex SHA-256 of a UTF-8 string, the shape every other digest in the
 *  shell uses (lib/rate-cards.ts, lib/export-history.ts). */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text) as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The identity of the record LIST the vectors were built against.
 *
 * Row `i` means "record `i`", so the vectors are only usable if the index the
 * browser just loaded has the same records in the same ORDER. Hashing each
 * record's `[p, a]` pair (page slug + section anchor) captures exactly that: a
 * reordered, inserted, removed or re-anchored section changes the hash, while a
 * pure prose edit does not (that is `corpusHash`'s job, checked at build time by
 * the staleness guard, not here).
 *
 * THE SERIALISATION IS THE CONTRACT with scripts/build-ask-vectors.ts:
 * `JSON.stringify(records.map((r) => [r.p, r.a]))`, i.e. a JSON array of
 * two-element arrays with no whitespace, hashed as UTF-8 and rendered lowercase
 * hex. Change it in one place only and every deploy silently drops to lexical.
 */
async function computeRecordsHash(records: readonly DocsRecord[]): Promise<string> {
  return sha256Hex(JSON.stringify(records.map((r) => [r.p, r.a])));
}

/**
 * Fetch + verify the vectors for one locale. Resolves null for every failure -
 * missing artifacts (the common case: the two files are English-only, and a
 * localised index has translated anchors that could never match anyway), a
 * corrupt bin, a manifest that disagrees with the header, or an index that has
 * drifted from the one the vectors were built against.
 */
async function fetchVectors(lang: Lang): Promise<QuantisedVectors | null> {
  const base = docsBase(lang);
  const [binRes, metaRes] = await Promise.all([
    fetch(`${base}/ask-vectors.bin`),
    fetch(`${base}/ask-vectors.json`),
  ]);
  if (!binRes.ok || !metaRes.ok) return null;
  const meta = (await metaRes.json()) as VectorsManifest;
  const vecs = parseVectorsBin(await binRes.arrayBuffer());
  if (meta.v !== vecs.version || meta.dim !== vecs.dim || meta.count !== vecs.count) return null;

  const records = (await loadDocsIndex()).map((p) => p.rec);
  if (records.length !== vecs.count) return null;
  if (meta.recordsHash !== await computeRecordsHash(records)) return null;
  return vecs;
}

// Module-level, locale-keyed cache, settled once per locale for the session -
// the same shape as the docs index this verifies against (search/docs-index.ts).
const cache = new Map<Lang, Promise<QuantisedVectors | null>>();

/**
 * The verified vectors for the active locale, or null when semantic ranking is
 * not available. Cached: fetched, parsed and hash-checked once per session per
 * locale, and a null result is cached too - a corpus that does not match will
 * not start matching mid-session, and retrieval must not re-fetch 245 KB per
 * keystroke to rediscover that.
 */
export function loadVectors(): Promise<QuantisedVectors | null> {
  const lang = currentLang();
  let p = cache.get(lang);
  if (!p) { p = fetchVectors(lang).catch(() => null); cache.set(lang, p); }
  return p;
}

/** Test seam - drop the cache so a suite can serve a fresh fixture. */
export function _resetVectorsCache(): void {
  cache.clear();
}
