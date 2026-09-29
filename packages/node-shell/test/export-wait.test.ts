// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Download, Page } from 'playwright-core';
import { advancingProgress, exportIdleTimeout, waitForExport, type ExportProgress } from '../src/export-wait.ts';

class FakePage extends EventEmitter {
  report!: (report: ExportProgress) => void;
  async exposeFunction(_name: string, fn: (report: ExportProgress) => void) { this.report = fn; }
  asPage() { return this as unknown as Page; }
}

test('motion gets ten minutes without progress, including animated WebP; overrides are seconds', () => {
  for (const format of ['mp4', 'WEBM', 'gif', 'apng', 'webp-anim']) assert.equal(exportIdleTimeout(format, ''), 600_000);
  assert.equal(exportIdleTimeout('pdf', ''), 90_000);
  assert.equal(exportIdleTimeout('png', ''), 60_000);
  assert.equal(exportIdleTimeout('mp4', '1800'), 1_800_000);
  for (const invalid of ['0', '-1', 'NaN', 'Infinity', '3000000']) assert.equal(exportIdleTimeout('mp4', invalid), 600_000);
});

test('only valid advancing reports refresh the wait', () => {
  const advance = advancingProgress();
  assert.equal(advance({ phase: 'start' }), true);
  assert.equal(advance({ phase: 'start' }), false);
  assert.equal(advance({ phase: 'progress', done: 0, total: 900 }), false);
  assert.equal(advance({ phase: 'progress', done: 10, total: 900 }), true);
  assert.equal(advance({ phase: 'progress', done: 10, total: 900 }), false);
  assert.equal(advance({ phase: 'progress', done: 9, total: 900 }), false);
  assert.equal(advance({ phase: 'progress', done: Infinity, total: 900 }), false);
  assert.equal(advance({ phase: 'progress', done: 901, total: 900 }), false);
  assert.equal(advance({ phase: 'progress', done: 1, total: 48000 }), true);
});

test('a progressing export outlives repeated idle windows and removes listeners after download', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new FakePage(), waiting = await waitForExport(page.asPage(), 'mp4', 1000);
  let failed = false; void waiting.result.catch(() => { failed = true; });
  for (let frame = 1; frame <= 20; frame++) {
    context.mock.timers.tick(900);
    page.report({ phase: 'progress', done: frame, total: 20 });
    await Promise.resolve(); assert.equal(failed, false);
  }
  const download = {} as Download;
  page.emit('download', download);
  assert.equal(await waiting.result, download);
  assert.equal(page.eventNames().length, 0);
  waiting.dispose(); context.mock.timers.tick(2000);
});

test('repeated progress cannot hide a stall; a page crash and cancellation also stop waiting', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new FakePage(), waiting = await waitForExport(page.asPage(), 'mp4', 1000);
  page.report({ phase: 'progress', done: 1, total: 10 });
  context.mock.timers.tick(900);
  page.report({ phase: 'progress', done: 1, total: 10 });
  context.mock.timers.tick(100);
  await assert.rejects(waiting.result, /No export progress or download for 1s/);
  assert.equal(page.eventNames().length, 0);
  for (const event of ['close', 'crash', 'cancel']) {
    const other = new FakePage(), run = await waitForExport(other.asPage(), 'mp4', 1000);
    if (event === 'cancel') run.dispose(); else other.emit(event);
    await assert.rejects(run.result, /closed|crashed|cancelled/);
    assert.equal(other.eventNames().length, 0);
  }
});

test('an explicit export failure reaches the caller immediately and removes listeners', async () => {
  const page = new FakePage(), waiting = await waitForExport(page.asPage(), 'png');
  page.emit('console', { text: () => 'Unrelated browser warning' });
  page.emit('console', { text: () => 'Auto-export failed: Error: Every sample must be before the timeline end (6s).' });
  await assert.rejects(waiting.result, /before the timeline end/);
  assert.equal(page.eventNames().length, 0);
});
