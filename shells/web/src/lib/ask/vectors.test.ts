// SPDX-License-Identifier: MPL-2.0
/**
 * Committed Ask vectors (plans/103 M1). Pins the ask-vectors.bin container - the
 * byte layout, every rejection, and that i8 dequantisation reproduces the f32
 * cosine closely enough to rank with - plus the runtime's refusal to use vectors
 * that were built against a different docs index.
 *
 * The bin fixtures are written BY HAND with a DataView here rather than through
 * a writer helper, so the test states the format independently of the parser and
 * scripts/build-ask-vectors.ts has an unambiguous spec to match.
 *
 * Run directly:  node --test shells/web/src/lib/ask/vectors.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

// The one fetch seam: routed by path, so loadVectors and the shared docs-index
// loader can be fed different fixtures in the same test.
interface Routes { index?: unknown; meta?: unknown; bin?: ArrayBuffer | null }
let routes: Routes = {};
globalThis.fetch = (async (url: string) => {
  const u = String(url);
  if (u.endsWith('/search-index.json')) return { ok: true, json: async () => routes.index ?? [] };
  if (u.endsWith('/ask-vectors.json')) return routes.meta ? { ok: true, json: async () => routes.meta } : { ok: false };
  if (u.endsWith('/ask-vectors.bin')) return routes.bin ? { ok: true, arrayBuffer: async () => routes.bin } : { ok: false };
  return { ok: false };
}) as unknown as typeof fetch;

const { parseVectorsBin, cosineTopK, loadVectors, _resetVectorsCache } = await import('./vectors.ts');
const { _resetDocsIndexCache } = await import('../search/docs-index.ts');

// ── fixture builders ──────────────────────────────────────────────────────────

const HEADER_BYTES = 24;

/** Deterministic pseudo-random components (an LCG), so the corpus and every
 *  assertion below are byte-stable across runs and machines. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x1_0000_0000 - 0.5; };
}

/** An L2-normalised row - exactly what the build script embeds and quantises. */
function normalisedRow(rand: () => number, dim: number): number[] {
  const v = Array.from({ length: dim }, rand);
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
}

/** The quantiser: per-row scale = max|v|, components = round(v / scale * 127). */
function quantise(v: readonly number[]): { scale: number; bytes: number[] } {
  const scale = Math.max(...v.map((x) => Math.abs(x)));
  return { scale, bytes: v.map((x) => Math.round((x / scale) * 127)) };
}

interface BinOpts { magic?: string; version?: number; reserved?: number; trailing?: number }

/** Write an ask-vectors.bin by hand: magic, u32 version/count/dim/reserved,
 *  f32 scales, then i8 rows - little-endian throughout. */
function buildBin(vectors: readonly (readonly number[])[], opts: BinOpts = {}): ArrayBuffer {
  const magic = opts.magic ?? 'LOLLYVEC';
  const count = vectors.length;
  const dim = vectors[0]!.length;
  const quantised = vectors.map(quantise);
  const buf = new ArrayBuffer(HEADER_BYTES + 4 * count + count * dim + (opts.trailing ?? 0));
  const dv = new DataView(buf);
  for (let i = 0; i < 8; i++) dv.setUint8(i, magic.charCodeAt(i));
  dv.setUint32(8, opts.version ?? 1, true);
  dv.setUint32(12, count, true);
  dv.setUint32(16, dim, true);
  dv.setUint32(20, opts.reserved ?? 0, true);
  const rowsAt = HEADER_BYTES + 4 * count;
  for (let i = 0; i < count; i++) {
    const q = quantised[i]!;
    dv.setFloat32(HEADER_BYTES + i * 4, q.scale, true);
    for (let j = 0; j < dim; j++) dv.setInt8(rowsAt + i * dim + j, q.bytes[j]!);
  }
  return buf;
}

/** The recordsHash contract, recomputed with node:crypto so the assertion does
 *  not lean on the module's own WebCrypto path. */
function recordsHashOf(records: ReadonlyArray<{ p: string; a: string }>): string {
  return createHash('sha256').update(JSON.stringify(records.map((r) => [r.p, r.a]))).digest('hex');
}

// ── container ─────────────────────────────────────────────────────────────────

test('parseVectorsBin round-trips a hand-written file', () => {
  const rand = lcg(7);
  const vectors = Array.from({ length: 4 }, () => normalisedRow(rand, 6));
  const parsed = parseVectorsBin(buildBin(vectors));

  assert.equal(parsed.version, 1);
  assert.equal(parsed.count, 4);
  assert.equal(parsed.dim, 6);
  assert.equal(parsed.scales.length, 4);
  assert.equal(parsed.rows.length, 24);
  vectors.forEach((v, i) => {
    const q = quantise(v);
    assert.ok(Math.abs(parsed.scales[i]! - Math.fround(q.scale)) < 1e-7, 'scale survives the f32 round-trip');
    assert.deepEqual([...parsed.rows.slice(i * 6, i * 6 + 6)], q.bytes);
  });
});

test('parseVectorsBin rejects bad magic, unknown version, dirty reserved and wrong length', () => {
  const rand = lcg(11);
  const vectors = Array.from({ length: 3 }, () => normalisedRow(rand, 5));
  assert.throws(() => parseVectorsBin(buildBin(vectors, { magic: 'LOLLYVEX' })), /bad magic/);
  assert.throws(() => parseVectorsBin(buildBin(vectors, { version: 2 })), /unsupported version 2/);
  assert.throws(() => parseVectorsBin(buildBin(vectors, { reserved: 1 })), /reserved/);
  assert.throws(() => parseVectorsBin(buildBin(vectors, { trailing: 1 })), /length/);
  assert.throws(() => parseVectorsBin(buildBin(vectors).slice(0, 20)), /header/);
  assert.throws(() => parseVectorsBin(buildBin(vectors).slice(0, HEADER_BYTES + 4)), /length/);
});

// ── cosine ────────────────────────────────────────────────────────────────────

/** The f32 reference: every row was normalised before quantisation and the query
 *  is normalised, so a plain dot product is the true cosine. */
function refCos(query: readonly number[], row: readonly number[]): number {
  return query.reduce((acc, q, j) => acc + q * row[j]!, 0);
}

test('dequantised cosine tracks the f32 reference within 0.02, best first', () => {
  const rand = lcg(23);
  const dim = 16;
  const vectors = Array.from({ length: 12 }, () => normalisedRow(rand, dim));
  const queryRow = normalisedRow(rand, dim);
  const parsed = parseVectorsBin(buildBin(vectors));

  const hits = cosineTopK(Float32Array.from(queryRow), parsed, vectors.length);
  assert.equal(hits.length, vectors.length);

  for (const hit of hits) {
    const exact = refCos(queryRow, vectors[hit.index]!);
    assert.ok(Math.abs(hit.cos - exact) <= 0.02, `row ${hit.index}: ${hit.cos} vs f32 ${exact}`);
  }

  const reference = vectors
    .map((v, index) => ({ index, cos: refCos(queryRow, v) }))
    .sort((a, b) => b.cos - a.cos)
    .map((h) => h.index);
  assert.deepEqual(hits.map((h) => h.index), reference, 'quantisation must not reorder a well-separated corpus');
  assert.ok(hits[0]!.cos > hits[hits.length - 1]!.cos);
});

test('cosineTopK caps at k, keeps ties in index order, and refuses a wrong-width query', () => {
  const rand = lcg(31);
  const dim = 8;
  const row = normalisedRow(rand, dim);
  // Three identical rows plus one deliberately opposite row.
  const parsed = parseVectorsBin(buildBin([row, row, row, row.map((x) => -x)]));
  const query = Float32Array.from(row);

  const top = cosineTopK(query, parsed, 2);
  assert.deepEqual(top.map((h) => h.index), [0, 1], 'ties keep the earlier row first');
  assert.ok(top[0]!.cos > 0.99);

  const all = cosineTopK(query, parsed, 4);
  assert.equal(all[3]!.index, 3);
  assert.ok(all[3]!.cos < -0.99, 'the opposite row lands last, near -1');

  assert.deepEqual(cosineTopK(new Float32Array(dim + 1), parsed, 2), [], 'a wrong-width query scores nothing');
  assert.deepEqual(cosineTopK(query, parsed, 0), []);
});

// ── load + verification ───────────────────────────────────────────────────────

const RECORDS = [
  { p: 'exporting', t: 'Exporting', h: '', a: '', x: 'intro' },
  { p: 'exporting', t: 'Exporting', h: 'Transparency', a: 'transparency', x: 'alpha' },
  { p: 'brand', t: 'Brand', h: 'Fonts', a: 'fonts', x: 'faces' },
];

function serveVectors(over: Partial<{ v: number; dim: number; count: number; recordsHash: string }> = {}): number[][] {
  const rand = lcg(97);
  const vectors = RECORDS.map(() => normalisedRow(rand, 4));
  routes = {
    index: RECORDS,
    bin: buildBin(vectors),
    meta: { v: 1, dim: 4, count: RECORDS.length, recordsHash: recordsHashOf(RECORDS), ...over },
  };
  _resetVectorsCache();
  _resetDocsIndexCache();
  return vectors;
}

test('loadVectors verifies the manifest against the header and the live index', async () => {
  const vectors = serveVectors();
  const loaded = await loadVectors();
  assert.ok(loaded, 'a matching manifest + index must load');
  assert.equal(loaded.count, RECORDS.length);
  assert.equal(loaded.dim, 4);
  // Row i answers for record i - the property the whole hybrid rerank rests on.
  const hits = cosineTopK(Float32Array.from(vectors[1]!), loaded, 1);
  assert.equal(hits[0]!.index, 1);
});

test('loadVectors resolves null when the index has drifted from the vectors', async () => {
  serveVectors({ recordsHash: recordsHashOf([...RECORDS, { p: 'new', a: 'section' }]) });
  assert.equal(await loadVectors(), null, 'a recordsHash mismatch must fall back to lexical, not rank on stale rows');

  // A reordered index hashes differently even though the record SET is the same.
  serveVectors();
  routes.index = [RECORDS[1], RECORDS[0], RECORDS[2]];
  _resetDocsIndexCache();
  _resetVectorsCache();
  assert.equal(await loadVectors(), null);
});

test('loadVectors resolves null for a manifest that disagrees with the header', async () => {
  for (const over of [{ v: 2 }, { dim: 384 }, { count: 2 }]) {
    serveVectors(over);
    assert.equal(await loadVectors(), null, `manifest ${JSON.stringify(over)} must be refused`);
  }
});

test('loadVectors resolves null for missing, corrupt or short artifacts, and caches the null', async () => {
  serveVectors();
  routes.bin = null; // 404
  _resetVectorsCache();
  assert.equal(await loadVectors(), null);

  serveVectors();
  routes.bin = buildBin([[1, 0, 0, 0]], { magic: 'NOTALOLLY' });
  _resetVectorsCache();
  assert.equal(await loadVectors(), null, 'a corrupt bin throws inside and surfaces as null');

  // The null is cached: a later fetch must not be attempted at all.
  let fetches = 0;
  const real = globalThis.fetch;
  globalThis.fetch = ((...args: unknown[]) => { fetches++; return (real as (...a: unknown[]) => unknown)(...args); }) as unknown as typeof fetch;
  assert.equal(await loadVectors(), null);
  assert.equal(fetches, 0, 'a settled null must not re-fetch 245 KB');
  globalThis.fetch = real;
});
