// SPDX-License-Identifier: MPL-2.0
/**
 * extractDocumentText (views/doc-read.ts) with `ensureOcr`: the Text recognition
 * model is offered once, before the first scanned page, instead of downloading
 * silently under a "Reading page 1" line. Verify's and the catalogue's document
 * reads pass lib/model-offer.ts ensureModel here.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/doc-read-offer.test.ts
 *
 * A real scanned one-page PDF; the reader is a stub, and jsdom's missing image
 * decoding and 2D canvas are stood in for so the page picture becomes a frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1, OcrFrame } from '@lolly-tools/core/host-v1';
import { scannedPdf } from './__fixtures__/scanned-pdf.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'DOMParser', 'XMLSerializer', 'Element', 'Node', 'HTMLElement']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
(globalThis as unknown as Record<string, unknown>).Image = class { onload: (() => void) | null = null; set src(_v: string) { queueMicrotask(() => this.onload?.()); } };
(dom.window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext(this: HTMLCanvasElement) {
  const { width, height } = this;
  return { fillStyle: '', fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) };
};
URL.createObjectURL = () => 'blob:stub';
URL.revokeObjectURL = () => {};

const { extractDocumentText } = await import('./doc-read.ts');
type Ocr = NonNullable<HostV1['ocr']>;

function reader(): { ocr: Ocr; frames: OcrFrame[] } {
  const frames: OcrFrame[] = [];
  const ocr = { run: async (f: OcrFrame) => { frames.push(f); return { text: 'Words from the scan', lines: [], lang: 'en' }; } } as unknown as Ocr;
  return { ocr, frames };
}
const pdf = (): Blob => new Blob([scannedPdf() as BlobPart], { type: 'application/pdf' });

test('the model is offered once, and a yes reads the scanned page', async () => {
  const { ocr, frames } = reader();
  let asked = 0;
  const r = await extractDocumentText(pdf(), ocr, undefined, { ensureOcr: async () => { asked++; return true; } });
  assert.equal(asked, 1);
  assert.equal(frames.length, 1);
  assert.equal(r.text, 'Words from the scan');
  assert.equal(r.source, 'ocr');
  assert.equal(r.notes.ocrPages, 1);
});

test('Not now leaves the scanned page unread and the notes say the model is not installed', async () => {
  const { ocr, frames } = reader();
  const r = await extractDocumentText(pdf(), ocr, undefined, { ensureOcr: async () => false });
  assert.equal(frames.length, 0);
  assert.equal(r.text, null);
  assert.equal(r.notes.ocrUnavailable, true);
  assert.equal(r.notes.scannedUnread, 1);
});

test('an offer that throws counts as Not now, never as a failed read', async () => {
  const { ocr, frames } = reader();
  const r = await extractDocumentText(pdf(), ocr, undefined, { ensureOcr: async () => { throw new Error('sheet failed'); } });
  assert.equal(frames.length, 0);
  assert.equal(r.notes.ocrUnavailable, true);
});

test('no reader at all: nothing is offered', async () => {
  let asked = 0;
  const r = await extractDocumentText(pdf(), null, undefined, { ensureOcr: async () => { asked++; return true; } });
  assert.equal(asked, 0);
  assert.equal(r.notes.ocrUnavailable, true);
});

test('Verify and the catalogue pass the in-place offer to their document reads', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['./valid.ts', './catalog/details-sheet.ts']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    const call = src.slice(src.indexOf('extractDocumentText('), src.indexOf('extractDocumentText(') + 600);
    assert.match(call, /ensureOcr: (?:dr\.)?offerTextRecognition \}/, file);
  }
  const own = readFileSync(new URL('./doc-read.ts', import.meta.url), 'utf8');
  assert.match(own, /offerTextRecognition = async \(\): Promise<boolean> =>\s*\(await import\('\.\.\/lib\/model-offer\.ts'\)\)\.ensureModel\('ocr', \{ reason: t\('Reading text in scanned pages'\) \}\)/);
});
