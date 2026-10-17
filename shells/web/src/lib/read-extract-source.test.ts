// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's reading for Read and extract (lib/read-extract-source.ts), over
 * the labelled fixtures in tests/fixtures/read-extract: the same readers as `lolly
 * read`, so the inventory it gives must match the host's, and a recogniser handed
 * in must reach every block it read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { unzipSync, zipSync } from 'fflate';
import type { OcrLine } from '@lolly-tools/core/host-v1';
import { readExtract } from '../../../../engine/src/read-extract.ts';
import { scoreExtract } from '../../../../engine/src/read-extract-quality.ts';
import { readContentInventory } from '../../../../packages/node-shell/src/content-inventory.ts';
import { decodePipelinePicture } from '../../../../packages/node-shell/src/rebrand/pipeline.ts';
import type { ReadExtractFixtureLabelsV1 } from '../../../../scripts/build-read-extract-fixtures.ts';
import { hostRecogniser, readExtractSource, ReadExtractSourceError, sniffExtractSource, type ExtractRecogniserV1 } from './read-extract-source.ts';

const FIXTURES = new URL('../../../../tests/fixtures/read-extract/', import.meta.url);
const bytesOf = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(name, FIXTURES)));
const labelsOf = (name: string): ReadExtractFixtureLabelsV1 => JSON.parse(readFileSync(new URL(`${name}.labels.json`, FIXTURES), 'utf8')) as ReadExtractFixtureLabelsV1;
const flat = (labels: ReadExtractFixtureLabelsV1) => labels.pages.flatMap((p) => p.blocks.map((b) => ({ page: p.page, text: b.text, origin: b.origin })));

const win = new JSDOM('').window;
const parseXml = (xml: string): Document => new win.DOMParser().parseFromString(xml, 'application/xml');

test('files are told apart by their bytes, and one this does not read is refused by name', async () => {
  assert.equal(sniffExtractSource(bytesOf('multilingual.pptx')), 'pptx');
  assert.equal(sniffExtractSource(bytesOf('multilingual.pdf')), 'pdf');
  assert.equal(sniffExtractSource(new TextEncoder().encode('8BPS....')), 'psd');
  assert.equal(sniffExtractSource(new TextEncoder().encode('just text')), null);
  await assert.rejects(readExtractSource({ name: 'notes.txt', bytes: new TextEncoder().encode('hello') }, { parseXml }), (err: unknown) => err instanceof ReadExtractSourceError && err.code === 'unsupported');
  await assert.rejects(readExtractSource({ name: 'empty.pdf', bytes: new Uint8Array(0) }, { parseXml }), (err: unknown) => err instanceof ReadExtractSourceError && err.code === 'empty');
  await assert.rejects(readExtractSource({ name: 'broken.pdf', bytes: new TextEncoder().encode('%PDF-1.4 nothing else') }, { parseXml }), (err: unknown) => err instanceof ReadExtractSourceError && err.code === 'unreadable');
});

for (const name of ['multilingual.pptx', 'multilingual.pdf']) {
  test(`${name} reads here as the host reads it, and scores the same against its labels`, async () => {
    const web = await readExtractSource({ name, bytes: bytesOf(name) }, { parseXml });
    const host = await readContentInventory({ bytes: bytesOf(name), name });
    const words = (inv: typeof web.inventory): string[][] => inv.slides.map((s) => s.text.map((t) => `${t.role}:${t.plain}`));
    assert.deepEqual(words(web.inventory), words(host.inventory), 'the same frames, roles and words in the same order');
    assert.deepEqual(web.inventory.slides.map((s) => s.notes?.text ?? null), host.inventory.slides.map((s) => s.notes?.text ?? null));
    assert.equal(web.inventory.source.sha256, host.inventory.source.sha256);
    const score = scoreExtract(flat(labelsOf(name)), readExtract(web.inventory));
    assert.equal(score.cer, 0);
    assert.equal(score.order, 1);
    assert.equal(score.recall, 1);
  });
}

test('a recogniser handed in reads the scans, and each block keeps its model, release and confidence', async () => {
  const labels = labelsOf('scan.pdf');
  // The recogniser reads back what the labels say was drawn, from the geometry of each crop.
  let page = -1;
  const run = async (frame: { width: number; height: number }, opts: { model?: string }, region: { id: string; box: { x: number; y: number } }): Promise<{ lines: OcrLine[] }> => {
    assert.equal(opts.model, 'stub-model');
    if (region.id === 'page') page++;
    const pad = region.id.startsWith('page') ? 0 : 4;
    const ox = Math.max(0, Math.floor(region.box.x - pad));
    const oy = Math.max(0, Math.floor(region.box.y - pad));
    const lines: OcrLine[] = [];
    for (const line of labels.pages[page]?.drawn ?? []) {
      const bottom = line.y + 7 * line.scale;
      if (line.y < oy || bottom > oy + frame.height) continue;
      const chars = Array.from(line.text);
      const inside = chars.map((ch, k) => ({ ch, k, x0: line.x + k * 6 * line.scale })).filter(({ ch, x0 }) => ch !== ' ' && x0 >= ox && x0 + 5 * line.scale <= ox + frame.width).map(({ k }) => k);
      if (!inside.length) continue;
      const first = Math.min(...inside);
      const last = Math.max(...inside);
      const x0 = line.x + first * 6 * line.scale - 3;
      const x1 = line.x + (last * 6 + 5) * line.scale + 3;
      const bx = Math.max(0, x0 - ox);
      const by = Math.max(0, line.y - 3 - oy);
      lines.push({ text: chars.slice(first, last + 1).join('').trim(), confidence: 0.9, box: { x: bx, y: by, w: Math.min(frame.width, x1 - ox) - bx, h: Math.min(frame.height, bottom + 3 - oy) - by } });
    }
    return { lines };
  };
  const recogniser: ExtractRecogniserV1 = { model: 'stub-model', read: async (frame, region) => (await run(frame, { model: 'stub-model' }, region)).lines };
  const progress: Array<[string, number, number]> = [];
  const out = await readExtractSource({ name: 'scan.pdf', bytes: bytesOf('scan.pdf') }, {
    parseXml,
    recogniser,
    decodePicture: decodePipelinePicture,
    recognizers: new Map([['stub-model', { version: '9', languages: ['en', 'fr'] }]]),
    onProgress: (phase, done, total) => progress.push([phase, done, total]),
  });
  assert.deepEqual(out.scanned, { pages: [1, 2], recognised: [1, 2] });
  assert.deepEqual(progress.filter(([phase]) => phase === 'recognise').at(-1), ['recognise', 2, 2]);
  const extract = readExtract(out.inventory);
  const score = scoreExtract(flat(labels), extract);
  assert.deepEqual([score.cer, score.order, score.recall, score.origin], [0, 1, 1, 1]);
  for (const block of extract.blocks.filter((b) => b.kind === 'text')) {
    assert.deepEqual(block.recognition, { model: 'stub-model', confidence: 0.9, minConfidence: 0.9, lines: 1, modelVersion: '9', languages: ['en', 'fr'] });
  }
});

test('hostRecogniser hands host.ocr a copy of each crop, with the model and the signal', async () => {
  const seen: Array<{ model?: string; aborted?: boolean; same: boolean }> = [];
  const frame = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) };
  const controller = new AbortController();
  const recogniser = hostRecogniser({
    run: async (given, opts) => {
      seen.push({ ...(opts.model ? { model: opts.model } : {}), aborted: opts.signal?.aborted ?? false, same: given.data === frame.data });
      return { lines: [{ text: 'x', confidence: 1, box: { x: 0, y: 0, w: 1, h: 1 } }] };
    },
  }, 'm1', controller.signal);
  const lines = await recogniser.read(frame, { id: 'page', box: { x: 0, y: 0, w: 1, h: 1 } } as Parameters<typeof recogniser.read>[1]);
  assert.equal(lines.length, 1);
  assert.deepEqual(seen, [{ model: 'm1', aborted: false, same: false }]);
});

test('a deck that carries macros reads without running them and says so', async () => {
  const parts = unzipSync(bytesOf('multilingual.pptx'));
  parts['ppt/vbaProject.bin'] = new TextEncoder().encode('Sub AutoOpen(): End Sub');
  const out = await readExtractSource({ name: 'deck.pptm', bytes: zipSync(parts, { level: 0 }) }, { parseXml });
  assert.deepEqual(out.inventory.warnings.map((w) => w.code), ['macros-not-run']);
});
