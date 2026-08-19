#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Builds the committed sentence-embedding index the Ask help surface reranks
 * with (plans/103 M1): shells/web/public/info/ask-vectors.bin plus its companion
 * ask-vectors.json. One vector per record of the ENGLISH /info search index, in
 * that index's own order, so a runtime cosine hit maps back to a record by
 * position alone.
 *
 * ANDY-RUN ONLY, and NETWORK-FREE once scripts/fetch-embed-model.ts has staged
 * the model. Nothing in `npm install`, the build chain or CI calls this file:
 * the two artifacts it writes are committed, which is the whole point. CI and
 * Vercel never load a model, and Tier 0 (lexical) answers do not need one either.
 *
 * Usage:
 *   node scripts/fetch-embed-model.ts     # once, needs network, ~23 MB
 *   npm run build:info                    # refresh the twins + the search index
 *   node scripts/build-ask-vectors.ts     # this script
 *
 * ── Inputs ────────────────────────────────────────────────────────────────
 *   shells/web/public/info/search-index.json   the English index docs/build.ts
 *                                              emits (indexSections), records
 *                                              {p,t,h,a,x,i}
 *   shells/web/public/info/<slug>.md           the verbatim markdown twins
 *   shells/web/public/models/embed/            the staged q8 MiniLM
 *
 * ── The chunk text ────────────────────────────────────────────────────────
 * Each record is aligned to its twin by lib/ask/chunks.ts alignPage, the SAME
 * function the runtime and the drift test use, so nothing here can quietly
 * disagree with what the app extracts. A record that cannot be aligned (its page
 * has no twin, e.g. the generated formats/* pages and the landing page) falls
 * back to the record's own 240-char `x` snippet, so index positions stay dense
 * and a vector row always means record i.
 *
 * The string handed to the model is the page title, the heading and that section
 * text joined by newlines, capped at EMBED_CHAR_MAX. The cap is a tokenizer-cost
 * bound, not a semantic decision: the model truncates at 512 tokens regardless,
 * and 4000 characters is comfortably past 512 tokens for any text in this corpus.
 *
 * ── The two hashes (recomputed identically by the runtime and by the guard) ──
 * Both are lowercase hex SHA-256 over a UTF-8 JSON.stringify with no spacing.
 *
 *   corpusHash  = sha256(JSON.stringify(sectionTexts))
 *                 sectionTexts[i] = (alignPage(twin, pageRecords)[k] ?? rec.x).trim()
 *                 one entry per index record, in the index's own order, '' when
 *                 there is neither an aligned section nor a snippet.
 *                 The STALENESS key: shells/web/src/lib/ask/vectors-staleness.test.ts
 *                 recomputes it from the twins + index on disk and fails when it
 *                 differs from the committed ask-vectors.json.
 *                 Note it hashes the section TEXTS, not the composed model input,
 *                 so EMBED_CHAR_MAX and the title/heading prefix can be retuned
 *                 without a false staleness failure.
 *
 *   recordsHash = sha256(JSON.stringify(index.map(r => [r.p, r.a])))
 *                 The POSITION key: the runtime checks it against the index it
 *                 actually fetched and falls back to lexical-only on a mismatch,
 *                 because a changed page/anchor order means row i no longer names
 *                 record i. A heading edit that leaves the anchor untouched is
 *                 caught by corpusHash instead.
 *
 * ── The bin format (little-endian throughout) ─────────────────────────────
 *   0    8 bytes   magic 'LOLLYVEC' (ASCII)
 *   8    u32       version = 1
 *   12   u32       count
 *   16   u32       dim = 384
 *   20   u32       reserved = 0
 *   24   f32 x count            per-row scale = max|v| of the L2-normalised vector
 *   ...  i8 x count x dim       row values, round(v / scale * 127)
 *
 * Total = 24 + 4*count + count*dim bytes. Dequantise as value * scale / 127.
 * A row whose scale would be 0 (an empty embedding) is written as scale 1 and an
 * all-zero row, which cosine-scores 0 rather than dividing by zero.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { alignPage, type AlignableRecord } from '../shells/web/src/lib/ask/chunks.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const INFO_DIR = join(ROOT, 'shells/web/public/info');
const MODEL_DIR = join(ROOT, 'shells/web/public/models/embed');
const INDEX_PATH = join(INFO_DIR, 'search-index.json');
const OUT_BIN = join(INFO_DIR, 'ask-vectors.bin');
const OUT_JSON = join(INFO_DIR, 'ask-vectors.json');

/** The transformers.js model id. Resolves to MODEL_DIR under localModelPath,
 *  exactly as the browser resolves '/models/embed/'. */
const MODEL_ID = 'embed';
/** Kept in step with scripts/fetch-embed-model.ts by hand (importing it would
 *  run that script's main()). Written into ask-vectors.json as `upstream`. */
const UPSTREAM = 'Xenova/all-MiniLM-L6-v2';
/** all-MiniLM-L6-v2's output width. Asserted against the real tensor below. */
const DIM = 384;
/** Sentences per forward pass. Padding is per batch, so a modest batch keeps the
 *  padded width near the real one. */
const BATCH = 16;
/** See the header: a tokenizer-cost bound, not a semantic one. */
const EMBED_CHAR_MAX = 4000;
/** ask-vectors.bin format version, written into both files. */
const FORMAT_VERSION = 1;
const MAGIC = 'LOLLYVEC';
const HEADER_BYTES = 24;

/** One /info search-index record, as docs/build.ts indexSections writes it. */
interface DocsRecord extends AlignableRecord { p: string; t: string; h: string; a: string; x: string; i?: string }

const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** The staleness key. See the header for the exact definition. */
export function corpusHashOf(sectionTexts: readonly string[]): string {
  return sha256Hex(JSON.stringify(sectionTexts));
}

/** The position key. See the header for the exact definition. */
export function recordsHashOf(index: readonly { p: string; a: string }[]): string {
  return sha256Hex(JSON.stringify(index.map((r) => [r.p, r.a])));
}

/**
 * Resolve every index record to its section text, in index order.
 *
 * Records are grouped by page slug (a page's records are contiguous today, but
 * grouping by slug does not depend on that), aligned as a page via alignPage,
 * then scattered back to their original positions. `readTwin` returns the twin's
 * markdown or null when the page has no twin.
 *
 * `alignedOut`, when given, is filled with one flag per record: true where the
 * text came from a real aligned section, false where it is the snippet fallback.
 * It exists only for this script's progress line and is safe to omit.
 *
 * shells/web/src/lib/ask/vectors-staleness.test.ts carries a copy of this walk.
 * It cannot import this module: the test lives inside the shells/web submodule,
 * which has to typecheck and run on its own without the parent repo's scripts/.
 * Change one, change the other.
 */
export function resolveSectionTexts(
  index: readonly DocsRecord[],
  readTwin: (slug: string) => string | null,
  alignedOut?: boolean[],
): string[] {
  const byPage = new Map<string, { rec: DocsRecord; at: number }[]>();
  index.forEach((rec, at) => {
    const list = byPage.get(rec.p) ?? [];
    list.push({ rec, at });
    byPage.set(rec.p, list);
  });

  const texts: string[] = new Array<string>(index.length).fill('');
  for (const [slug, list] of byPage) {
    const md = readTwin(slug);
    const aligned = md === null ? list.map(() => null) : alignPage(md, list.map((e) => e.rec));
    list.forEach((entry, k) => {
      texts[entry.at] = (aligned[k] ?? entry.rec.x ?? '').trim();
      if (alignedOut) alignedOut[entry.at] = aligned[k] !== null;
    });
  }
  return texts;
}

/** The string the model sees for one record: page title, heading, section text. */
function embedInput(rec: DocsRecord, sectionText: string): string {
  const joined = [rec.t, rec.h, sectionText]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join('\n')
    .slice(0, EMBED_CHAR_MAX);
  return joined.length > 0 ? joined : ' '; // the tokenizer rejects an empty string
}

/** The transformers.js surface this script touches. The package's own typings
 *  are bundler-hostile generics, so the same minimal-shape approach as
 *  scripts/build-docs-audio.ts applies here. */
interface TensorLike { data: Float32Array; dims: number[] }
type Extractor = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<TensorLike>;

function bail(lines: string[]): never {
  console.error(`\nbuild-ask-vectors: ${lines[0]}`);
  for (const line of lines.slice(1)) console.error(line);
  process.exit(1);
}

async function loadExtractor(): Promise<Extractor> {
  if (!existsSync(join(MODEL_DIR, 'onnx', 'model_quantized.onnx'))) {
    bail([
      `the embedding model is not staged (${MODEL_DIR}).`,
      'Fetch it once (sha256-pinned, ~23 MB):',
      '',
      '  node scripts/fetch-embed-model.ts',
      '',
      'then re-run. Everything from there is offline.',
    ]);
  }
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    // The same three lines the web worker sets (lib/speech-kokoro-worker.ts),
    // Node-side: nothing may reach the HuggingFace hub, and the model id
    // resolves under the staged directory. wasmPaths is web-only; in Node the
    // package runs onnxruntime-node.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = join(MODEL_DIR, '..'); // MODEL_ID 'embed' resolves to MODEL_DIR
    const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
    return extractor as unknown as Extractor;
  } catch (err) {
    return bail([
      `could not load the embedding model from ${MODEL_DIR}: ${(err as Error).message}`,
      '(@huggingface/transformers is declared in shells/web and normally hoists to the',
      'repo-root node_modules. If it did not, run `npm install` at the root, or run this',
      'script from shells/web so the dependency resolves there.)',
    ]);
  }
}

/** Quantise one L2-normalised row to int8 plus its scale. */
function quantiseRow(v: Float32Array): { scale: number; row: Int8Array } {
  let max = 0;
  for (let i = 0; i < v.length; i++) {
    const a = Math.abs(v[i]!);
    if (a > max) max = a;
  }
  const row = new Int8Array(v.length);
  if (!(max > 0) || !Number.isFinite(max)) return { scale: 1, row }; // all-zero row
  for (let i = 0; i < v.length; i++) {
    const q = Math.round((v[i]! / max) * 127);
    row[i] = q > 127 ? 127 : q < -127 ? -127 : q;
  }
  return { scale: max, row };
}

/** Assemble the .bin exactly as documented in the header. */
function packVectors(scales: Float32Array, rows: Int8Array, count: number, dim: number): Buffer {
  const buf = Buffer.alloc(HEADER_BYTES + 4 * count + count * dim);
  buf.write(MAGIC, 0, 'ascii');
  buf.writeUInt32LE(FORMAT_VERSION, 8);
  buf.writeUInt32LE(count, 12);
  buf.writeUInt32LE(dim, 16);
  buf.writeUInt32LE(0, 20); // reserved
  for (let i = 0; i < count; i++) buf.writeFloatLE(scales[i]!, HEADER_BYTES + 4 * i);
  Buffer.from(rows.buffer, rows.byteOffset, rows.byteLength).copy(buf, HEADER_BYTES + 4 * count);
  return buf;
}

async function main(): Promise<void> {
  if (!existsSync(INDEX_PATH)) {
    bail([
      `no English search index at ${INDEX_PATH}.`,
      'Run `npm run build:info` first, which writes the index and the markdown twins.',
    ]);
  }
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as DocsRecord[];
  if (!Array.isArray(index) || index.length === 0) bail([`${INDEX_PATH} holds no records.`]);

  const readTwin = (slug: string): string | null => {
    const p = join(INFO_DIR, `${slug}.md`);
    return existsSync(p) ? readFileSync(p, 'utf-8') : null;
  };
  const alignedFlags: boolean[] = [];
  const sectionTexts = resolveSectionTexts(index, readTwin, alignedFlags);
  const alignedCount = alignedFlags.filter(Boolean).length;
  process.stdout.write(
    `Corpus: ${index.length} records over ${new Set(index.map((r) => r.p)).size} pages ` +
    `(${alignedCount} aligned to a full section, ${index.length - alignedCount} on the 240-char snippet).\n`,
  );

  const corpusHash = corpusHashOf(sectionTexts);
  const recordsHash = recordsHashOf(index);

  const extractor = await loadExtractor();
  const inputs = index.map((rec, i) => embedInput(rec, sectionTexts[i]!));

  const scales = new Float32Array(index.length);
  const rows = new Int8Array(index.length * DIM);
  const started = Date.now();
  for (let start = 0; start < inputs.length; start += BATCH) {
    const batch = inputs.slice(start, start + BATCH);
    const out = await extractor(batch, { pooling: 'mean', normalize: true });
    const [n, dim] = [out.dims[0]!, out.dims[1]!];
    if (dim !== DIM) bail([`the model returned ${dim} dimensions, expected ${DIM}.`]);
    if (n !== batch.length) bail([`the model returned ${n} vectors for ${batch.length} inputs.`]);
    for (let k = 0; k < n; k++) {
      const v = out.data.subarray(k * dim, (k + 1) * dim);
      const { scale, row } = quantiseRow(v);
      scales[start + k] = scale;
      rows.set(row, (start + k) * DIM);
    }
    const done = Math.min(start + BATCH, inputs.length);
    process.stdout.write(`\r  embedding ${done}/${inputs.length} (${Math.round((done / inputs.length) * 100)}%)   `);
  }
  process.stdout.write(`\r  embedded ${inputs.length} sections in ${((Date.now() - started) / 1000).toFixed(1)}s        \n`);

  const bin = packVectors(scales, rows, index.length, DIM);
  writeFileSync(OUT_BIN, bin);

  const meta = {
    v: FORMAT_VERSION,
    model: MODEL_ID,
    upstream: UPSTREAM,
    dim: DIM,
    count: index.length,
    dtype: 'q8',
    corpusHash,
    recordsHash,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(OUT_JSON, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');

  process.stdout.write(
    `\nWrote ${OUT_BIN} (${bin.byteLength} bytes, ${(bin.byteLength / 1024).toFixed(1)} KB)\n` +
    `Wrote ${OUT_JSON}\n` +
    `  count ${meta.count}  dim ${meta.dim}  dtype ${meta.dtype}\n` +
    `  corpusHash  ${corpusHash}\n` +
    `  recordsHash ${recordsHash}\n` +
    '\nCommit both files. Re-run this script after any `npm run build:info` that moves the\n' +
    'docs corpus, or vectors-staleness.test.ts fails on the corpusHash.\n',
  );
}

main().catch((err) => {
  console.error(`\nbuild-ask-vectors failed: ${(err as Error).message}`);
  process.exit(1);
});
