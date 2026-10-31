// SPDX-License-Identifier: MPL-2.0
/**
 * The wait a link export runs before it writes a file (lib/export-settle.ts).
 *
 * The bug it closes: `#/tool/certificate?pageSize=story&format=png&export` exported
 * before the tool had been told its size and before its last hook run had come back,
 * so the file had the A4 layout's size and a sheet without the issuer logo.
 *
 * Run: node --test shells/web/src/lib/export-settle.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SETTLE_PASSES, settleForExport, type SettleTarget } from './export-settle.ts';

/** A fake view: a runtime whose hook run finishes after setCanvasSize, and a paint loop. */
function fakeView(opts: { repaints?: number } = {}) {
  const log: string[] = [];
  let painted = 'a4';
  let queued: string | null = null;
  let repaints = opts.repaints ?? 1;
  const target: SettleTarget = {
    runtime: {
      async setCanvasSize(size) { log.push(`size ${size?.width}x${size?.height}`); },
      async whenSettled() {
        log.push('settled');
        // The size run (and any run it starts) answers with a new drawing each time.
        if (repaints-- > 0) queued = `story-${repaints}`;
      },
    },
    flush() { if (queued) { painted = queued; queued = null; log.push(`paint ${painted}`); } },
    shown: () => painted,
    pending: () => queued !== null,
    quiet: async () => { log.push('quiet'); },
  };
  return { target, log, shown: () => painted };
}

test('the tool hears the export size first, and the export waits for the drawing that answers it', async () => {
  const view = fakeView({ repaints: 1 });
  await settleForExport(view.target, { width: 1080, height: 1920 });
  assert.deepEqual(view.log, ['size 1080x1920', 'settled', 'paint story-0', 'quiet', 'settled']);
  assert.equal(view.shown(), 'story-0', 'the canvas shows the answer to the size, not the first layout');
});

test('a document that has already settled is exported after one check', async () => {
  const view = fakeView({ repaints: 0 });
  await settleForExport(view.target, null);
  assert.deepEqual(view.log, ['settled'], 'no size to tell, nothing new painted, no extra quiet wait');
});

test('a tool that keeps answering is bounded, not waited on forever', async () => {
  const view = fakeView({ repaints: 100 });
  await settleForExport(view.target, { width: 10, height: 10 });
  assert.equal(view.log.filter((l) => l === 'settled').length, SETTLE_PASSES);
});

test('a canvas size the runtime refuses is reported and the settle carries on', async () => {
  const warnings: string[] = [];
  const view = fakeView({ repaints: 0 });
  view.target.runtime.setCanvasSize = async () => { throw new Error('no'); };
  view.target.warn = (message) => { warnings.push(message); };
  await settleForExport(view.target, { width: 10, height: 10 });
  assert.deepEqual(warnings, ['Canvas size']);
  assert.deepEqual(view.log, ['settled']);
});
