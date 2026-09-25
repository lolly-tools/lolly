// SPDX-License-Identifier: MPL-2.0
/**
 * views/pdf-extract-ocr.ts: Unpack's reading of scanned pages.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/pdf-extract-ocr.test.ts
 *
 * The offer (ensureModel), the page frames and the reader are stubs; the job is
 * the real lib/jobs.ts, so the toast's progress and cancel are what is checked.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PageText } from '@lolly/engine';
import type { OcrFrame, OcrResult } from '@lolly-tools/core/host-v1';

const { readScannedPages, pageFromOcr, scanReadSummary } = await import('./pdf-extract-ocr.ts');
const { startJob, cancelJob, jobsSnapshot, __resetJobsForTest } = await import('../lib/jobs.ts');
type Deps = import('./pdf-extract-ocr.ts').ScanReadDeps;

const scanned = (): PageText => ({ blocks: [], text: '', markdown: '', columns: 1, scanned: true, rotated: 0, order: 'geometric' });
const frame: OcrFrame = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
const result = (text: string): OcrResult => ({ text, lines: [], lang: 'en' });

function deps(over: Partial<Deps> = {}): Deps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ensure: async (reason) => { calls.push(`ensure:${reason}`); return true; },
    frame: async (i) => { calls.push(`frame:${i}`); return frame; },
    read: async () => { calls.push('read'); return result('Hello\n\nWorld'); },
    startJob,
    ...over,
  };
}

beforeEach(() => { __resetJobsForTest(); });

test('the model is offered first, then every page is read and handed back in order', async () => {
  const d = deps();
  const seen: Array<[number, PageText | null]> = [];
  const out = await readScannedPages(new Map([[4, scanned()], [1, scanned()]]), d, {
    onPage: (i, page) => seen.push([i, page]),
  });
  assert.equal(d.calls[0], 'ensure:Reading text in scanned pages');
  assert.deepEqual(d.calls.slice(1), ['frame:1', 'read', 'frame:4', 'read']);
  assert.deepEqual(seen.map(([i]) => i), [1, 4]);
  assert.equal(seen[0]![1]!.scanned, false);
  assert.equal(seen[0]![1]!.text, 'Hello\n\nWorld');
  assert.deepEqual({ ...out }, { status: 'done', read: 2, empty: 0, failed: 0 });
  assert.equal(jobsSnapshot().at(-1)?.status, 'done');
});

test('Not now on the offer starts no job and leaves every page as it was', async () => {
  const d = deps({ ensure: async () => false });
  let pages = 0;
  const out = await readScannedPages(new Map([[0, scanned()]]), d, { onPage: () => { pages++; } });
  assert.equal(out.status, 'declined');
  assert.equal(pages, 0);
  assert.equal(jobsSnapshot().length, 0);
  assert.equal(d.calls.length, 0);
});

test('a page that will not draw or read is counted and the rest still read', async () => {
  let n = 0;
  const d = deps({
    frame: async (i) => (i === 0 ? null : frame),
    read: async () => { n++; if (n === 1) throw new Error('bad page'); return result('ok'); },
  });
  const out = await readScannedPages(new Map([[0, scanned()], [1, scanned()], [2, scanned()]]), d);
  assert.deepEqual({ ...out }, { status: 'done', read: 1, empty: 0, failed: 2 });
});

test('a picture with no words reports the page as empty, not read', async () => {
  const seen: Array<PageText | null> = [];
  const out = await readScannedPages(new Map([[0, scanned()]]), deps({ read: async () => result('   ') }), {
    onPage: (_i, page) => seen.push(page),
  });
  assert.deepEqual(seen, [null]);
  assert.equal(out.empty, 1);
  assert.equal(scanReadSummary(out), 'No readable text was found in the scanned pages.');
});

test('cancel from the toast stops before the next page and aborts the read', async () => {
  let aborted = false;
  const d = deps({
    read: (_f, signal) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => { aborted = true; const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
      queueMicrotask(() => { const job = jobsSnapshot().at(-1); if (job) cancelJob(job.id); });
    }),
  });
  const out = await readScannedPages(new Map([[0, scanned()], [1, scanned()]]), d);
  assert.equal(aborted, true);
  assert.equal(out.status, 'cancelled');
  assert.equal(d.calls.filter((c) => c.startsWith('frame')).length, 1);
});

test('a full heavy queue says so instead of dropping the read', async () => {
  const out = await readScannedPages(new Map([[0, scanned()]]), deps({ startJob: () => { throw new Error('queue full'); } }));
  assert.equal(out.status, 'busy');
  assert.match(scanReadSummary(out), /Another job is running/);
});

test('pageFromOcr folds the words in as plain paragraphs', () => {
  const p = pageFromOcr(scanned(), ' First line\nsame para \n\n\nSecond ');
  assert.equal(p.scanned, false);
  assert.deepEqual(p.blocks.map((b) => [b.kind, b.text]), [['paragraph', 'First line\nsame para'], ['paragraph', 'Second']]);
  assert.equal(p.markdown, 'First line\nsame para\n\nSecond');
});

test('reading is announced only once the offer settles, and a document left meanwhile is not read', async () => {
  let started = 0;
  const d = deps();
  const out = await readScannedPages(new Map([[0, scanned()]]), d, { onStart: () => { started++; }, wanted: () => false });
  assert.equal(out.status, 'declined', 'the offer came back after the person left the document');
  assert.equal(started, 0, 'nothing claimed to be reading');
  assert.equal(jobsSnapshot().length, 0, 'and no job started');

  let alive = true;
  const d2 = deps({ read: async () => { alive = false; return result('first'); } });
  const pages: number[] = [];
  const out2 = await readScannedPages(new Map([[0, scanned()], [1, scanned()]]), d2, {
    onStart: () => { started++; }, wanted: () => alive, onPage: (i) => pages.push(i),
  });
  assert.equal(started, 1);
  assert.deepEqual(pages, [0], 'the read stops at the next page once it is no longer wanted');
  assert.equal(out2.status, 'cancelled');
});
