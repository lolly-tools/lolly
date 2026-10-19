// SPDX-License-Identifier: MPL-2.0
/**
 * The labelled Read and extract fixtures (plan 203, rank 10), read end to end:
 * tests/fixtures/read-extract, built by scripts/build-read-extract-fixtures.ts.
 *
 * Each file goes through the host reader (`readContentInventory`) and the engine's
 * `readExtract`, and the result is scored against the hand-written labels with
 * `scoreExtract`: character and word error rates over each page in reading order,
 * the share of labelled blocks found, the share of pairs in the labelled order,
 * and the share whose origin (authored, text layer, recognised) is the labelled
 * one. A test asserts those numbers, never only that some text came back.
 *
 * The scans are read twice. A stand-in recogniser reads the lines the labels say
 * were drawn, from the geometry of each crop the rebuild asks about, so the whole
 * path (rebuild, recognition record, extract) runs on every machine. Where the
 * PP-OCRv5 model is on disk (`lolly models fetch ocr`), the real recogniser reads
 * them too and its error rates are measured against the same labels.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/read-extract-fixtures.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { unzipSync, zipSync } from 'fflate';

import { readExtract, type ReadExtractOptsV1 } from '../engine/src/read-extract.ts';
import { scoreExtract, type LabelledBlockV1 } from '../engine/src/read-extract-quality.ts';
import type { OcrLine } from '../packages/core/src/host-v1.ts';
import type { ReadExtractV1 } from '../packages/core/src/read-extract-v1.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import type { FlattenedOcrV1 } from '../packages/node-shell/src/rebrand/flattened.ts';
import {
  buildReadExtractFixtures, READ_EXTRACT_FIXTURES_DIR, type FixtureDrawnLineV1, type ReadExtractFixtureLabelsV1,
} from '../scripts/build-read-extract-fixtures.ts';

const schema = JSON.parse(readFileSync(new URL('../schemas/read-extract-v1.schema.json', import.meta.url), 'utf8')) as object;
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const assertValid = (doc: unknown): void => {
  assert.ok(validate(doc), `the extract breaks its schema: ${JSON.stringify(validate.errors?.slice(0, 5))}`);
};

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(READ_EXTRACT_FIXTURES_DIR, name)));
const labelsOf = (name: string): ReadExtractFixtureLabelsV1 =>
  JSON.parse(readFileSync(join(READ_EXTRACT_FIXTURES_DIR, `${name}.labels.json`), 'utf8')) as ReadExtractFixtureLabelsV1;
const flatLabels = (labels: ReadExtractFixtureLabelsV1): LabelledBlockV1[] =>
  labels.pages.flatMap((page) => page.blocks.map((block) => ({ page: page.page, text: block.text, origin: block.origin })));

async function extractOf(name: string, read: Partial<Parameters<typeof readContentInventory>[0]> = {}, opts: ReadExtractOptsV1 = {}): Promise<ReadExtractV1> {
  const { inventory } = await readContentInventory({ bytes: fixture(name), name, ...read });
  const out = readExtract(inventory, opts);
  assertValid(out);
  return out;
}

// ─── the files themselves ────────────────────────────────────────────────────

test('the committed fixtures are what the builder makes, byte for byte', () => {
  for (const built of buildReadExtractFixtures()) {
    assert.ok(Buffer.from(fixture(built.name)).equals(Buffer.from(built.bytes)), `${built.name} matches its builder; run node scripts/build-read-extract-fixtures.ts`);
    assert.equal(readFileSync(join(READ_EXTRACT_FIXTURES_DIR, built.labelsName), 'utf8'), built.labelsText, `${built.labelsName} matches its builder`);
  }
});

test('the labels cover eight languages in five scripts, and state an origin for every block', () => {
  const all = ['multilingual.pptx', 'multilingual.pdf', 'scan.pdf'].map(labelsOf);
  const languages = new Set(all.flatMap((l) => l.pages.flatMap((p) => p.languages)));
  for (const lang of ['en', 'fr', 'de', 'es', 'el', 'ru', 'ja', 'ar']) assert.ok(languages.has(lang), `a page in ${lang}`);
  const words = all.flatMap((l) => l.pages.flatMap((p) => p.blocks.map((b) => b.text))).join(' ');
  for (const script of ['Latin', 'Greek', 'Cyrillic', 'Han', 'Arabic']) {
    assert.ok(new RegExp(`\\p{Script=${script}}`, 'u').test(words), `labelled text in ${script} script`);
  }
  for (const labels of all) {
    assert.equal(labels.licence, 'MPL-2.0');
    for (const page of labels.pages) for (const block of page.blocks) assert.ok(['authored', 'text-layer', 'recognized'].includes(block.origin));
  }
});

// ─── authored text ───────────────────────────────────────────────────────────

test('multilingual.pptx reads every language exactly, in order, as authored text with its notes, table and picture', async () => {
  const labels = labelsOf('multilingual.pptx');
  const out = await extractOf('multilingual.pptx');
  const score = scoreExtract(flatLabels(labels), out);
  assert.deepEqual(score, { cer: 0, wer: 0, recall: 1, order: 1, origin: 1, labelled: 14, matched: 14 });
  for (const page of labels.pages) {
    const own = out.blocks.filter((b) => b.page === page.page);
    const text = own.filter((b) => b.kind === 'text');
    page.blocks.forEach((label, k) => { if (label.role) assert.equal(text[k]!.role, label.role, `page ${page.page} block ${k} is a ${label.role}`); });
    assert.deepEqual(text.slice(1).map((b) => b.role), text.slice(1).map(() => 'body'), `page ${page.page}: the lines under the title are body, in every script`);
    assert.equal(own.find((b) => b.kind === 'notes')?.text, page.notes, `page ${page.page} notes`);
    assert.deepEqual(own.filter((b) => b.kind === 'table').map((b) => b.rows), page.tables ?? [], `page ${page.page} tables`);
    assert.equal(own.filter((b) => b.kind === 'picture').length, page.pictures ?? 0, `page ${page.page} pictures`);
  }
  assert.deepEqual(out.warnings, [], 'a plain deck carries no warning');
});

test('multilingual.pdf keeps two columns apart, its accents intact and its scan text layer as text-layer words', async () => {
  const labels = labelsOf('multilingual.pdf');
  const out = await extractOf('multilingual.pdf');
  const score = scoreExtract(flatLabels(labels), out);
  assert.deepEqual(score, { cer: 0, wer: 0, recall: 1, order: 1, origin: 1, labelled: 17, matched: 17 });
  const scan = out.pages.find((p) => p.number === 3)!;
  assert.deepEqual(scan, { number: 3, scanned: true, read: 'text-layer', blocks: 2 });
  const layer = out.blocks.find((b) => b.page === 3 && b.kind === 'text')!;
  assert.deepEqual(layer.recognition, { model: 'pdf-text-layer', confidence: 1, minConfidence: 1, lines: 2 });
  assert.ok(out.blocks.some((b) => b.page === 3 && b.kind === 'picture'), 'the page picture is still listed');
  assert.ok(out.warnings.some((w) => w.code === 'slide-flattened' && /text layer the scan carries/.test(w.message)));
});

// ─── recognised text ─────────────────────────────────────────────────────────

/** The stand-in's confidence for a line drawn in dark ink, and for the faint line. */
const DARK_CONFIDENCE = 0.96;
const FAINT_CONFIDENCE = 0.58;
const DARK_INK = '#111111';
/** A detector's box is a few px wider than the ink it boxes. */
const DETECTOR_PAD = 3;

/**
 * A recogniser that reads what the labels say was drawn: the characters of each
 * line whose glyph cells lie wholly inside the crop, boxed in the crop's own
 * pixels, as `host.ocr.run` returns lines. A page crop has no padding; the rebuild
 * crops a colour region with 4 px of context.
 */
function drawnRecogniser(pages: Array<FixtureDrawnLineV1[] | undefined>): FlattenedOcrV1 {
  let page = -1;
  return async (frame, region) => {
    if (region.id === 'page') page++;
    const drawn = pages[page] ?? [];
    const pad = region.id.startsWith('page') ? 0 : 4;
    const ox = Math.max(0, Math.floor(region.box.x - pad));
    const oy = Math.max(0, Math.floor(region.box.y - pad));
    const lines: OcrLine[] = [];
    for (const line of drawn) {
      const top = line.y;
      const bottom = line.y + 7 * line.scale;
      if (top < oy || bottom > oy + frame.height) continue;
      const chars = Array.from(line.text);
      const inside = chars
        .map((ch, k) => ({ ch, k, x0: line.x + k * 6 * line.scale }))
        .filter(({ ch, x0 }) => ch !== ' ' && x0 >= ox && x0 + 5 * line.scale <= ox + frame.width)
        .map(({ k }) => k);
      if (!inside.length) continue;
      const first = Math.min(...inside);
      const last = Math.max(...inside);
      const text = chars.slice(first, last + 1).join('').trim();
      const x0 = line.x + first * 6 * line.scale - DETECTOR_PAD;
      const x1 = line.x + (last * 6 + 5) * line.scale + DETECTOR_PAD;
      const bx = Math.max(0, x0 - ox);
      const by = Math.max(0, top - DETECTOR_PAD - oy);
      lines.push({
        text,
        confidence: line.ink === DARK_INK ? DARK_CONFIDENCE : FAINT_CONFIDENCE,
        box: { x: bx, y: by, w: Math.min(frame.width, x1 - ox) - bx, h: Math.min(frame.height, bottom + DETECTOR_PAD - oy) - by },
      });
    }
    return lines;
  };
}

test('scan.pdf without a recogniser says its pages were not read rather than reading as empty', async () => {
  const labels = labelsOf('scan.pdf');
  const out = await extractOf('scan.pdf');
  assert.deepEqual(out.pages.map((p) => [p.scanned, p.read]), [[true, 'not-read'], [true, 'not-read']]);
  assert.equal(out.blocks.filter((b) => b.kind === 'text').length, 0);
  assert.equal(out.warnings.filter((w) => w.code === 'page-not-read').length, 2);
  const score = scoreExtract(flatLabels(labels), out);
  assert.equal(score.recall, 0, 'the score says so too');
  assert.equal(score.cer, 1);
});

test('scan.pdf read by a recogniser records the model and its confidence on every block', async () => {
  const labels = labelsOf('scan.pdf');
  const ocr = drawnRecogniser(labels.pages.map((p) => p.drawn));
  const out = await extractOf('scan.pdf', { ocr, ocrModel: 'ppocr-v5-mobile' });
  const score = scoreExtract(flatLabels(labels), out);
  assert.deepEqual(score, { cer: 0, wer: 0, recall: 1, order: 1, origin: 1, labelled: 5, matched: 5 });
  assert.deepEqual(out.pages.map((p) => p.read), ['recognized', 'recognized']);
  const text = out.blocks.filter((b) => b.kind === 'text');
  for (const block of text) {
    assert.equal(block.origin, 'recognized');
    assert.equal(block.recognition?.model, 'ppocr-v5-mobile');
    assert.equal(block.recognition?.modelVersion, 'v5-mobile', 'the release comes from the node catalogue');
    assert.ok(block.recognition?.languages?.includes('fr'), 'and the languages the model reads');
  }
  const faint = text.find((b) => b.text === 'UNE LIGNE CLAIRE EST PLUS DURE')!;
  assert.equal(faint.recognition?.confidence, FAINT_CONFIDENCE, 'the faint line keeps the low confidence the recogniser gave it');
  assert.ok(text.filter((b) => b !== faint).every((b) => b.recognition?.confidence === DARK_CONFIDENCE));
});

test('a confidence floor and a budget bound a recognised file the same way as an authored one', async () => {
  const labels = labelsOf('scan.pdf');
  // A fresh recogniser for each read: it counts the pages it has been shown.
  const read = (): { ocr: FlattenedOcrV1; ocrModel: string } => ({ ocr: drawnRecogniser(labels.pages.map((p) => p.drawn)), ocrModel: 'ppocr-v5-mobile' });
  const floored = await extractOf('scan.pdf', read(), { kinds: ['text'], minConfidence: 0.7 });
  assert.deepEqual(floored.blocks.map((b) => b.text), ['READ THIS PAGE', 'THE SECOND LINE IS SMALLER', 'A THIRD AND FINAL LINE.', 'LA QUALITÉ COMPTE']);
  assert.ok(floored.warnings.some((w) => w.code === 'low-confidence-left-out'));

  const { inventory } = await readContentInventory({ bytes: fixture('scan.pdf'), name: 'scan.pdf', ...read() });
  const whole = readExtract(inventory, { kinds: ['text'] });
  assert.equal(whole.blocks.length, 5);
  const seen: string[] = [];
  let from: string | undefined;
  do {
    const part = readExtract(inventory, { kinds: ['text'], maxChars: 40, ...(from ? { from } : {}) });
    seen.push(...part.blocks.map((b) => b.text));
    from = part.complete ? undefined : part.next;
  } while (from);
  assert.deepEqual(seen, whole.blocks.map((b) => b.text), 'reading in 40 character steps returns every line once, in order');
  const second = readExtract(inventory, { pages: '2', kinds: ['text'] });
  assert.deepEqual(second.blocks.map((b) => b.page), [2, 2]);
});

// ─── what a file carries ─────────────────────────────────────────────────────

test('a deck that carries macros is read without running them, and says so', async () => {
  const parts = unzipSync(fixture('multilingual.pptx'));
  parts['ppt/vbaProject.bin'] = new TextEncoder().encode('Sub AutoOpen(): Shell "calc": End Sub');
  const bytes = zipSync(parts, { level: 0, mtime: '2026-01-01T00:00:00' });
  const { inventory } = await readContentInventory({ bytes, name: 'multilingual.pptm' });
  const out = readExtract(inventory);
  assert.deepEqual(out.warnings.map((w) => w.code), ['macros-not-run']);
  assert.match(out.warnings[0]!.message, /ppt\/vbaProject\.bin.*were not run/);
  assert.equal(scoreExtract(flatLabels(labelsOf('multilingual.pptx')), out).cer, 0, 'the slides read as before');
});

// ─── the real recogniser, where its model is on disk ─────────────────────────

const realRunner = await (async (): Promise<{ ocr: FlattenedOcrV1; model: string } | string> => {
  const { nodeFlattenedOcr } = await import('../packages/node-shell/src/rebrand/ocr-node.ts');
  const runner = await nodeFlattenedOcr();
  // One reason on every machine, the one the other OCR-gated tests give, so the CI skip baseline matches the skip exactly.
  return runner.ok ? { ocr: runner.ocr, model: runner.model } : 'the ocr model family is not on this machine';
})();

test(
  'scan.pdf read by the PP-OCRv5 model: error rates measured against the labels (needs lolly models fetch ocr)',
  { skip: typeof realRunner === 'string' ? realRunner : false, timeout: 300_000 },
  async (t) => {
    if (typeof realRunner === 'string') return;
    const labels = labelsOf('scan.pdf');
    const out = await extractOf('scan.pdf', { ocr: realRunner.ocr, ocrModel: realRunner.model });
    const score = scoreExtract(flatLabels(labels), out);
    t.diagnostic(`PP-OCRv5 on scan.pdf: ${JSON.stringify(score)}`);
    assert.ok(out.blocks.filter((b) => b.kind === 'text').every((b) => b.origin === 'recognized' && b.recognition?.model === realRunner.model));
    // The bitmap face is clean, upright and large: a working recogniser reads most of the words.
    assert.ok(score.recall >= 0.8, `recall ${score.recall}`);
    assert.ok(score.cer <= 0.15, `character error rate ${score.cer}`);
    assert.equal(score.order, 1);
  },
);
