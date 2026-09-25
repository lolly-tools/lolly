// SPDX-License-Identifier: MPL-2.0
/**
 * lib/model-offer.ts: the in-context model download offer.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/model-offer.test.ts
 *
 * jsdom with a real origin (the modal's Back handling needs history) and
 * showModal/close stubbed on the prototype, as in welcome-dialog.test.ts. The part
 * facts and the downloader are stubbed through the module's test hook; the job
 * run is the real lib/offline-run.ts.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { ensureModel, holdModelOffers, offerSentence, __setModelOfferDepsForTest } = await import('./model-offer.ts');
const { offlineRunActive, __resetOfflineRunForTest } = await import('./offline-run.ts');
const { __resetJobsForTest, jobsSnapshot } = await import('./jobs.ts');
type Info = import('./model-parts.ts').ModelPartInfo;
type Progress = import('./offline-manager.ts').DownloadProgress;

const info = (over: Partial<Info> = {}): Info => ({
  id: 'ocr', label: 'Text recognition', available: true, allowed: true, bytes: 21_462_903, ready: false, source: 'models-manifest', ...over,
});
const sheet = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.model-offer');
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
async function sheetOpen(): Promise<HTMLDialogElement> {
  for (let i = 0; i < 20 && !sheet(); i++) await tick();
  const el = sheet();
  assert.ok(el, 'the offer sheet is mounted');
  return el;
}
const click = (el: HTMLElement, sel: string): void => el.querySelector<HTMLElement>(sel)!.click();

let notices: string[] = [];
beforeEach(() => {
  document.body.innerHTML = '';
  __resetOfflineRunForTest();
  __resetJobsForTest();
  notices = [];
  __setModelOfferDepsForTest({
    info: async () => info(),
    download: async () => {},
    notify: (m) => { notices.push(m); },
    activated: () => true,
  });
});

test('ready already: resolves true with no sheet', async () => {
  __setModelOfferDepsForTest({ info: async () => info({ ready: true }), notify: (m) => { notices.push(m); }, activated: () => true });
  assert.equal(await ensureModel('ocr'), true);
  assert.equal(sheet(), null);
  assert.deepEqual(notices, []);
});

test('missing, then downloaded: the sheet names the size and the feature, hands progress to the job toast, resolves true', async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  let sawSignal = false;
  __setModelOfferDepsForTest({
    info: async () => info(),
    notify: (m) => { notices.push(m); },
    activated: () => true,
    download: async (id, opts) => {
      assert.equal(id, 'ocr');
      sawSignal = opts.signal instanceof AbortSignal;
      opts.onProgress({ loaded: 10 * 1024 * 1024, total: 20 * 1024 * 1024, done: 1, count: 3 } satisfies Progress);
      await gate;
    },
  });
  const result = ensureModel('ocr', { reason: 'Reading text in slide pictures' });
  const el = await sheetOpen();
  assert.equal(el.querySelector('.modal-title')?.textContent, 'Text recognition');
  assert.equal(el.querySelector('.modal-msg')?.textContent, '20 MB download, needed for: Reading text in slide pictures.');
  assert.match(el.textContent ?? '', /The model stays on this device\. What you give it never leaves\./);
  assert.equal(el.querySelector('[role="progressbar"], .job-bar, [aria-live]'), null, 'the sheet has no progress display of its own');
  click(el, '[data-act="download"]');
  await tick();
  assert.equal(sheet(), null, 'Download closes the sheet');
  assert.equal(offlineRunActive(), true, 'the download runs as the shared offline run');
  const job = jobsSnapshot().find(j => j.title === 'Downloading: Text recognition');
  assert.ok(job, 'so the job toast shows it, the one progress display');
  release();
  assert.equal(await result, true);
  assert.ok(sawSignal);
  assert.equal(offlineRunActive(), false, 'and the run has ended');
});

test('another download already running: the sheet says so and stays open', async () => {
  const { beginOfflineRun } = await import('./offline-run.ts');
  const other = beginOfflineRun('Downloading tools')!;
  const result = ensureModel('ocr');
  const el = await sheetOpen();
  click(el, '[data-act="download"]');
  const error = el.querySelector<HTMLElement>('[data-error]')!;
  assert.equal(error.hidden, false);
  assert.match(error.textContent ?? '', /Another download is running/);
  assert.ok(sheet(), 'still open');
  click(el, '[data-act="later"]');
  assert.equal(await result, false);
  other.end();
});

test('Not now resolves false and downloads nothing', async () => {
  let downloads = 0;
  __setModelOfferDepsForTest({ info: async () => info(), notify: () => {}, activated: () => true, download: async () => { downloads++; } });
  const result = ensureModel('ocr');
  const el = await sheetOpen();
  click(el, '[data-act="later"]');
  assert.equal(await result, false);
  assert.equal(downloads, 0);
  assert.equal(offlineRunActive(), false);
});

test('unavailable: resolves false with a notice in words, no sheet', async () => {
  __setModelOfferDepsForTest({ info: async () => info({ available: false }), notify: (m) => { notices.push(m); }, activated: () => true });
  assert.equal(await ensureModel('ocr'), false);
  assert.equal(sheet(), null);
  assert.deepEqual(notices, ['Text recognition can’t be downloaded here right now.']);
});

test('forbidden by policy: resolves false with the policy notice, no sheet', async () => {
  __setModelOfferDepsForTest({ info: async () => info({ allowed: false }), notify: (m) => { notices.push(m); }, activated: () => true });
  assert.equal(await ensureModel('ocr'), false);
  assert.equal(sheet(), null);
  assert.deepEqual(notices, ['AI downloads are disabled by your service policy.']);
});

test('concurrent calls for one part share one sheet and one answer', async () => {
  const a = ensureModel('ocr');
  const b = ensureModel('ocr');
  assert.equal(a, b, 'the same promise');
  const el = await sheetOpen();
  assert.equal(document.querySelectorAll('dialog.model-offer').length, 1);
  click(el, '[data-act="download"]');
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
});

test('a failed download resolves false and the job reports the failure', async () => {
  let attempts = 0;
  __setModelOfferDepsForTest({
    info: async () => info(), notify: () => {}, activated: () => true,
    download: async () => { attempts++; throw new Error('offline'); },
  });
  const result = ensureModel('ocr');
  const el = await sheetOpen();
  click(el, '[data-act="download"]');
  assert.equal(await result, false);
  assert.ok(jobsSnapshot().some(j => j.status === 'failed'), 'the job toast shows the failure');
  assert.equal(offlineRunActive(), false);
  assert.equal(attempts, 1);
});

test('never over a held import, and never before the person has interacted', async () => {
  const release = holdModelOffers();
  assert.equal(await ensureModel('ocr'), false);
  assert.equal(sheet(), null);
  assert.equal(notices.length, 1);
  release();
  release();

  __setModelOfferDepsForTest({ info: async () => info(), notify: (m) => { notices.push(m); }, activated: () => false });
  assert.equal(await ensureModel('ocr'), false);
  assert.equal(sheet(), null, 'no sheet opens on its own at page load');
  assert.equal(notices.at(-1), 'Press again to download Text recognition.', 'but the person is told how to get it');
});

test('the sentence prints a size only when it is known', () => {
  assert.equal(offerSentence({ bytes: undefined }, 'Removing a background'), 'Needed for: Removing a background.');
  assert.equal(offerSentence({ bytes: 4_574_861 }), 'This is a 4.4 MB download.');
  assert.equal(offerSentence({ bytes: undefined }), 'Download it once to use it.');
  assert.doesNotMatch(offerSentence({ bytes: 0 }), /0 B/);
});
