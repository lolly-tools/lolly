// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack on a scanned PDF: the Read the text offer, in the view.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/pdf-extract-scan.test.ts
 *
 * A real one-page PDF whose page is one image and no text (so the engine's text
 * pass calls it scanned) goes through the real Unpack view. The model offer is
 * stubbed through lib/model-offer.ts's test hook, host.ocr is a stub reader, and
 * jsdom's missing image decoding and 2D canvas are stood in for, so the page
 * picture becomes a frame.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1, OcrFrame } from '@lolly-tools/core/host-v1';
import { scannedPdf } from './__fixtures__/scanned-pdf.ts';

const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'http://localhost/#/unpack', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'DOMParser', 'XMLSerializer', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'history', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
g.ResizeObserver = class { observe() {} disconnect() {} };
g.IntersectionObserver = class { observe() {} disconnect() {} };
g.CSS = { escape: (value: string) => value };
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom decodes no images and has no 2D context: an Image that loads at once and
// a context that yields a blank frame of the canvas size.
g.Image = class { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(_v: string) { queueMicrotask(() => this.onload?.()); } };
(dom.window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = function getContext(this: HTMLCanvasElement) {
  const { width, height } = this;
  return { fillStyle: '', fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) };
};
URL.createObjectURL = () => 'blob:stub';
URL.revokeObjectURL = () => {};

const { mountPdfExtract } = await import('./pdf-extract.ts');
const { __setModelOfferDepsForTest } = await import('../lib/model-offer.ts');
const { __resetJobsForTest } = await import('../lib/jobs.ts');
type Info = import('../lib/model-parts.ts').ModelPartInfo;

const info = (over: Partial<Info> = {}): Info => ({
  id: 'ocr', label: 'Text recognition', available: true, allowed: true, bytes: 21_462_903, ready: true, source: 'models-manifest', ...over,
});
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

interface Rig { view: HTMLElement & { _cleanup?: () => void }; reads: OcrFrame[]; copied: string[]; offers: string[]; notices: string[] }

async function mount(opts: { ocr?: boolean; info?: Partial<Info> } = {}): Promise<Rig> {
  const view = document.querySelector<HTMLElement>('#view')! as Rig['view'];
  view._cleanup?.();
  view.innerHTML = '';
  const rig: Rig = { view, reads: [], copied: [], offers: [], notices: [] };
  __setModelOfferDepsForTest({
    info: async (id) => { rig.offers.push(id); return info(opts.info); },
    notify: (m) => { rig.notices.push(m); },
    activated: () => true,
  });
  const host = {
    profile: { get: async () => ({}) },
    state: { get: async () => null, set: async () => {} },
    clipboard: { writeText: async (s: string) => { rig.copied.push(s); } },
    log() {},
    ...(opts.ocr === false ? {} : {
      ocr: {
        isAvailable: () => true,
        run: async (frame: OcrFrame) => { rig.reads.push(frame); return { text: 'Scanned words here', lines: [], lang: 'en' }; },
      },
    }),
  } as unknown as HostV1;
  await mountPdfExtract(view, host);
  const input = view.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([scannedPdf() as BlobPart], 'scan.pdf', { type: 'application/pdf' })] });
  input.dispatchEvent(new dom.window.Event('change'));
  for (let i = 0; i < 200 && !view.querySelector('[role="tablist"]'); i++) await tick();
  assert.ok(view.querySelector('[role="tablist"]'), view.textContent ?? 'no result');
  return rig;
}

beforeEach(() => { __resetJobsForTest(); });
after(() => {
  (document.querySelector('#view') as (HTMLElement & { _cleanup?: () => void }) | null)?._cleanup?.();
  __setModelOfferDepsForTest();
  dom.window.close();
});

test('an all-scan document offers Read scanned pages once, and reading fills the page in place', async () => {
  const rig = await mount();
  assert.equal(rig.view.querySelector('[data-read-scan]'), null, 'no per-page button repeats the bar button when every page is a scan');
  const btn = rig.view.querySelector<HTMLButtonElement>('[data-act="read-scans"]');
  assert.ok(btn, 'the bar offers Read scanned pages');
  assert.match(rig.view.querySelector('[data-scan-note]')!.textContent!, /Read scanned pages finds the words on this device/);
  btn.click();
  for (let i = 0; i < 100 && rig.view.querySelector('.pdfx-page--scan'); i++) await tick();
  assert.deepEqual(rig.offers, ['ocr'], 'the model offer is asked first, for Text recognition');
  assert.equal(rig.reads.length, 1);
  assert.equal(rig.view.querySelector('.pdfx-page--scan'), null);
  assert.match(rig.view.querySelector('.pdfx-page[data-page="0"]')!.textContent!, /Scanned words here/);
  assert.match(rig.view.querySelector('.pdfx-page[data-page="0"]')!.textContent!, /read with text recognition/);
  assert.doesNotMatch(rig.view.querySelector('.pdfx-sum')!.textContent!, /scanned/);
  assert.equal(rig.view.querySelector('[data-act="read-scans"]'), null);
  assert.equal(rig.view.querySelector('[data-scan-note]'), null);
  rig.view.querySelector<HTMLButtonElement>('[data-act="copy"]')!.click();
  await tick();
  assert.match(rig.copied.at(-1) ?? '', /Scanned words here/, 'Copy all carries the read page');
});

test('when the model cannot be had, the page stays as it was and no read runs', async () => {
  const rig = await mount({ info: { ready: false, available: false } });
  rig.view.querySelector<HTMLButtonElement>('[data-act="read-scans"]')!.click();
  for (let i = 0; i < 20 && !rig.notices.length; i++) await tick();
  await tick();
  assert.equal(rig.notices.length, 1, 'the offer says why in a notice');
  assert.equal(rig.reads.length, 0);
  const again = rig.view.querySelector<HTMLButtonElement>('[data-act="read-scans"]')!;
  assert.ok(rig.view.querySelector('.pdfx-page--scan'));
  assert.equal(again.getAttribute('aria-disabled'), null, 'the button is an offer again');
  assert.equal(again.textContent, 'Read scanned pages', 'it never claimed to be reading');
});

test('a shell that cannot read keeps the plain scanned line and no button', async () => {
  const rig = await mount({ ocr: false });
  assert.equal(rig.view.querySelector('[data-read-scan]'), null);
  assert.equal(rig.view.querySelector('[data-act="read-scans"]'), null);
  assert.match(rig.view.querySelector('.pdfx-scan')!.textContent!, /text recognition is not available here/);
});
