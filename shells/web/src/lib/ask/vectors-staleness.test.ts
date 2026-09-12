// SPDX-License-Identifier: MPL-2.0
/**
 * The CI drift guard for the committed Ask vectors (plans/103 M1).
 *
 * public/info/ask-vectors.bin holds one embedding per record of the English
 * /info search index, produced by scripts/build-ask-vectors.ts from the markdown
 * twins under public/info/. Nothing in the build chain regenerates it, so the
 * day the docs corpus moves and nobody re-runs that script, the app would rerank
 * against stale meaning with no visible symptom. This test is what makes that
 * loud: it recomputes the corpus hash from the twins and the index on disk,
 * using the same lib/ask/chunks.ts alignment the build script used, and fails
 * when it differs from the committed ask-vectors.json.
 *
 * It SKIPS with a note when ask-vectors.json is absent, so a tree that only has
 * M0 (no vectors, lexical answers) stays green.
 *
 * Fixing a failure is one command:
 *   node scripts/build-ask-vectors.ts     (after pnpm run build:info)
 *
 * ── The hash definitions ──────────────────────────────────────────────────
 * Documented in full in scripts/build-ask-vectors.ts's header, and repeated here
 * because this file has to recompute them byte for byte. Both are lowercase hex
 * SHA-256 over a UTF-8 JSON.stringify with no spacing.
 *
 *   corpusHash  = sha256(JSON.stringify(sectionTexts))
 *                 sectionTexts[i] = (alignPage(twin, pageRecords)[k] ?? rec.x).trim()
 *                 one entry per index record, in the index's own order.
 *   recordsHash = sha256(JSON.stringify(index.map(r => [r.p, r.a])))
 *
 * The resolveSectionTexts walk below is a deliberate copy of the one in
 * scripts/build-ask-vectors.ts. It cannot import it: this file lives under
 * shells/web, whose tsconfig project does not include scripts/. Change one,
 * change the other.
 *
 * Run directly:  node --test shells/web/src/lib/ask/vectors-staleness.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { alignPage, type AlignableRecord } from './chunks.ts';

interface Rec extends AlignableRecord { p: string; t: string; h: string; a: string; x: string }

/** The companion metadata scripts/build-ask-vectors.ts writes beside the .bin. */
interface VectorsMeta {
  v: number;
  model: string;
  upstream: string;
  dim: number;
  count: number;
  dtype: string;
  corpusHash: string;
  recordsHash: string;
  builtAt: string;
}

const INFO = fileURLToPath(new URL('../../../public/info/', import.meta.url));
const META_PATH = `${INFO}ask-vectors.json`;
const BIN_PATH = `${INFO}ask-vectors.bin`;
const INDEX_PATH = `${INFO}search-index.json`;

// Absent vectors is a normal state (an M0-only tree, or a checkout that has not
// run the build). Absent index/twins is the docs build not having run, which
// chunks.test.ts already reports; skipping here keeps one message per cause.
const SKIP = !existsSync(META_PATH)
  ? 'no public/info/ask-vectors.json (M0-only tree) - run node scripts/build-ask-vectors.ts to add it'
  : !existsSync(INDEX_PATH)
    ? 'no public/info/search-index.json - run pnpm run build:info first'
    : false;

const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** See the header: the copy of scripts/build-ask-vectors.ts's walk. */
function resolveSectionTexts(index: readonly Rec[], readTwin: (slug: string) => string | null): string[] {
  const byPage = new Map<string, { rec: Rec; at: number }[]>();
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
    });
  }
  return texts;
}

test('committed ask-vectors match the docs corpus on disk', { skip: SKIP }, () => {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8')) as VectorsMeta;
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as Rec[];

  const texts = resolveSectionTexts(index, (slug) => {
    const p = `${INFO}${slug}.md`;
    return existsSync(p) ? readFileSync(p, 'utf-8') : null;
  });

  assert.equal(
    meta.count,
    index.length,
    `ask-vectors.json says ${meta.count} vectors but the index has ${index.length} records - re-run node scripts/build-ask-vectors.ts`,
  );
  assert.equal(
    meta.recordsHash,
    sha256Hex(JSON.stringify(index.map((r) => [r.p, r.a]))),
    'the index page/anchor order moved, so vector row i no longer names record i - re-run node scripts/build-ask-vectors.ts',
  );
  assert.equal(
    meta.corpusHash,
    sha256Hex(JSON.stringify(texts)),
    'the docs corpus changed since the vectors were built - re-run node scripts/build-ask-vectors.ts',
  );
});

test('the committed .bin header agrees with ask-vectors.json', { skip: SKIP }, () => {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8')) as VectorsMeta;
  assert.ok(existsSync(BIN_PATH), 'ask-vectors.json is committed without its ask-vectors.bin');
  const buf = readFileSync(BIN_PATH);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  assert.equal(buf.subarray(0, 8).toString('ascii'), 'LOLLYVEC', 'bad magic in ask-vectors.bin');
  assert.equal(dv.getUint32(8, true), meta.v, 'bin format version differs from ask-vectors.json');
  assert.equal(dv.getUint32(12, true), meta.count, 'bin count differs from ask-vectors.json');
  assert.equal(dv.getUint32(16, true), meta.dim, 'bin dim differs from ask-vectors.json');
  // 24-byte header, then f32 scales, then one int8 row per vector.
  assert.equal(
    buf.byteLength,
    24 + 4 * meta.count + meta.count * meta.dim,
    'ask-vectors.bin is not the length its own header implies',
  );
});
