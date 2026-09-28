// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserExportProgress } from './export-progress.ts';

test('browser observer reports real export work and preserves the existing progress callback', async () => {
  const old = globalThis.window;
  const reports: unknown[] = [], values: number[] = [];
  try {
    Object.assign(globalThis, { window: {} });
    const opts = { onProgress: (done: number) => { values.push(done); } };
    assert.equal(browserExportProgress(opts), opts);
    Object.assign(window, { __lollyExportProgress: async (report: unknown) => { reports.push(report); } });
    browserExportProgress(opts).onProgress!(7, 10);
    assert.deepEqual(reports, [{ phase: 'start' }, { phase: 'progress', done: 7, total: 10 }]);
    assert.deepEqual(values, [7]);
    Object.assign(window, { __lollyExportProgress: () => Promise.reject(new Error('observer disconnected')) });
    browserExportProgress(opts).onProgress!(8, 10);
    await Promise.resolve();
    assert.deepEqual(values, [7, 8]);
  } finally { Object.assign(globalThis, { window: old }); }
});
