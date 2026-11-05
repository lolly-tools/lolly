// SPDX-License-Identifier: MPL-2.0
/**
 * Keep text PDF redaction, end to end through the committed module: what it removes, what it
 * keeps, and that the shell's own check refuses a result that is not clean.
 *
 * The corpus tests generate PDFs from a seed, redact them, and read the results with an oracle
 * that shares no code with the shipped checker (see lib-keep-text-corpus.ts).
 *
 * Run with: node --test tests/redact-keep-text.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPdfA11yKernel } from '../packages/node-shell/src/pdf-a11y-node.ts';
import { PdfKeepTextError, type PdfA11yKernel } from '../packages/node-shell/src/pdf-a11y.ts';
import { checkKeepTextOutput, redactKeepText, KEEP_TEXT_INK } from '../packages/node-shell/src/pdf-redact-keep.ts';
import { cross, makeCorpusPdf, oracle } from './lib-keep-text-corpus.ts';

test('keep text: the words under a box are gone, the rest stays real text', async () => {
  const kernel = await loadPdfA11yKernel();
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const font = await doc.embedFont(StandardFonts.Courier);
  page.drawText('Hello SECRET world', { x: 20, y: 150, size: 12, font });
  page.drawText('Second line stays', { x: 20, y: 100, size: 12, font });
  const bytes = new Uint8Array(await doc.save());
  const run = await redactKeepText(kernel, bytes, { bars: [{ page: 1, x: 62, y: 38, w: 46, h: 18 }] } as never);
  assert.equal(run.pages, 1);
  assert.ok(run.summary.glyphs >= 6);
  const { loadPdfDocument, interpretPdfDocPage } = await import('../packages/node-shell/src/pdf-read.ts');
  const out = interpretPdfDocPage(await loadPdfDocument(run.bytes), 0);
  const text = out.nodes.filter(n => n.kind === 'text').map(n => n.text).join('|');
  assert.ok(!text.includes('SECRET'), text);
  assert.ok(text.includes('Second line stays'), text);
  assert.ok(!new TextDecoder('latin1').decode(run.bytes).includes('SECRET'));
});

test('keep text: the checker finds text, pictures and drawings under a box in an unredacted file', async () => {
  const corpus = await makeCorpusPdf(7);
  const findings = await checkKeepTextOutput(corpus.bytes, [{ page: 1, x: 0, y: 0, w: 300, h: 400 }], KEEP_TEXT_INK);
  assert.ok(findings.some(f => f.kind === 'text'));
  assert.ok(findings.some(f => f.kind === 'vector'));
});

test('keep text: a module that returns the file untouched is refused and no bytes come back', async () => {
  const corpus = await makeCorpusPdf(3);
  const lying: PdfA11yKernel = {
    retired: false,
    check: () => { throw new Error('unused'); },
    redact: bytes => ({ bytes, summary: { v: 1, marks: 1, pages: 1, glyphs: 99, images_removed: 0, images_cleared: 0, paths_removed: 0, paths_clipped: 0, forms_rewritten: 0, forms_removed: 0, annotations: 0, fields: 0, tags: 0, xfa_removed: false, sanitized: [] } }),
  };
  const bar = { page: 1, x: 0, y: 0, w: 300, h: 400 };
  await assert.rejects(redactKeepText(lying, corpus.bytes, { bars: [bar] } as never), (e: unknown) => e instanceof PdfKeepTextError && e.code === 'refused' && /default mode|Turn Keep text off/.test(e.message));
});

test('keep text: the oracle does see content under a box in an unredacted file', async () => {
  const corpus = await makeCorpusPdf(11);
  const seen = await oracle(corpus.bytes, { ...corpus, bars: [{ page: 1, x: 0, y: 0, w: 300, h: 400 }] });
  assert.ok(seen.survivors.some(s => s.startsWith('glyph')) && seen.survivors.includes('vector'));
});

test('keep text: a box on a page the file does not have is refused by the module', async () => {
  const kernel = await loadPdfA11yKernel();
  const corpus = await makeCorpusPdf(4);
  await assert.rejects(redactKeepText(kernel, corpus.bytes, { bars: [{ page: 2, x: 1, y: 1, w: 5, h: 5 }] } as never), PdfKeepTextError);
  await assert.rejects(redactKeepText(kernel, new TextEncoder().encode('not a pdf'), { bars: [{ page: 1, x: 1, y: 1, w: 5, h: 5 }] } as never), PdfKeepTextError);
});

test('keep text: a fuzzed corpus keeps no glyph, picture or drawing under any box', async () => {
  const kernel = await loadPdfA11yKernel();
  const SEEDS = 120;
  let accepted = 0, refused = 0, clear = 0, kept = 0, checkedUnder = 0, imageBoxes = 0, vectorBoxes = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const corpus = await makeCorpusPdf(seed);
    let run: Awaited<ReturnType<typeof redactKeepText>>;
    try { run = await redactKeepText(kernel, corpus.bytes, { bars: corpus.bars } as never); } catch (e) {
      assert.ok(e instanceof PdfKeepTextError, `seed ${seed}: ${String(e)}`);
      refused++; continue;
    }
    accepted++;
    const seen = await oracle(run.bytes, corpus);
    assert.deepEqual(seen.survivors, [], `seed ${seed} left content under a box`);
    clear += seen.clearGlyphs; kept += seen.keptGlyphs;
    checkedUnder += corpus.bars.length;
    const box = (b: { x: number; y: number; w: number; h: number }) => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });
    imageBoxes += corpus.bars.filter(b => corpus.images.some(i => cross(i.rect, box(b)))).length;
    vectorBoxes += corpus.bars.filter(b => corpus.rects.some(r => cross(r, box(b)))).length;
  }
  console.log(`keep text corpus: ${SEEDS} files, ${accepted} accepted, ${refused} refused, ${checkedUnder} boxes read, ${kept}/${clear} clear glyphs kept, ${imageBoxes} boxes over pictures, ${vectorBoxes} over drawings`);
  assert.ok(imageBoxes >= 10 && vectorBoxes >= 20, 'the corpus must reach pictures and drawings');
  assert.ok(accepted >= SEEDS * 0.8, `only ${accepted} of ${SEEDS} files were accepted`);
  assert.ok(kept >= clear * 0.97, `kept ${kept} of ${clear} glyphs that were clear of every box`);
});
