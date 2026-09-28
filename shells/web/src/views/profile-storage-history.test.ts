// SPDX-License-Identifier: MPL-2.0
/**
 * Settings > Storage > History (plan 277 P4 section 5): checkpoints, previews and
 * recovery drafts, each named with its bytes as the revision store counts them,
 * with Open History and "Remove automatic checkpoints older than 30 days".
 *
 * The row's words and numbers come from views/profile-storage-model.ts, fed here
 * by the real revision store over the in-memory IndexedDB after three checkpoints;
 * the wiring into views/profile/storage.ts is a source pin, the
 * profile-offline-rows.test.ts convention.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-storage-history.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from '../bridge/idb-memory.test-utils.ts';
import type { StateDb } from '../bridge/state.ts';
import { historyBytes, historyParts, pruneOutcome, reconciliationSentence, type StorageModel } from './profile-storage-model.ts';

const STORAGE_SRC = readFileSync(new URL('./profile/storage.ts', import.meta.url), 'utf8');

test('three checkpoints in QR Code show as named history bytes', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-27T09:00:00Z') });
  const { createStateAPI } = await import('../bridge/state.ts');
  const { createRevisionStore } = await import('../bridge/revision-history.ts');
  const { db: memory } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const history = createStateAPI(db as unknown as StateDb, createRevisionStore(db)).history!;
  const start = Date.parse('2026-09-27T09:00:00Z');
  for (let i = 0; i < 3; i++) {
    context.mock.timers.setTime(start + i * 2 * 60_000);
    const cursor = await history.current('qr-code:launch');
    const entry = await history.checkpoint('qr-code:launch', { __toolId: 'qr-code', __label: 'Launch', payload: 'url', url: `https://example.com/${i}` },
      { reason: 'automatic', expectedHead: cursor.head, expectedVersion: cursor.version });
    await history.attachPreview(entry.id, `data:image/png;base64,${'B'.repeat(3000)}`);
  }
  const cursor = await history.current('qr-code:launch');
  await history.recovery.save('qr-code:launch', { __toolId: 'qr-code', url: 'https://example.com/typing' }, { writerId: 'tab', expectedHead: cursor.head, expectedVersion: cursor.version });
  const usage = await history.usage();
  assert.ok(usage.checkpoints > 0 && usage.checkpoints < 1024, `checkpoints ${usage.checkpoints} B: small documents, deflated`);
  assert.equal(usage.previews, 3 * (3000 + 'data:image/png;base64,'.length));
  assert.ok(usage.recovery > 0, 'the recovery draft is counted');
  assert.equal(historyBytes(usage), usage.checkpoints + usage.previews + usage.recovery);
  assert.match(historyParts(usage), /^Checkpoints \d+ B · Previews 8\.9 KB · Recovery drafts \d+ B$/);
});

test('the row sentences: each part named, and what removing old checkpoints did', () => {
  assert.equal(historyParts({ checkpoints: 2 * 1024 * 1024, previews: 512 * 1024, recovery: 0 }), 'Checkpoints 2.0 MB · Previews 512 KB · Recovery drafts 0 B');
  assert.equal(pruneOutcome(0, 0), 'No automatic checkpoints are older than 30 days.');
  assert.equal(pruneOutcome(1, 2048), 'Removed 1 automatic checkpoint older than 30 days (2.0 KB).');
  assert.equal(pruneOutcome(12, 3 * 1024 * 1024), 'Removed 12 automatic checkpoints older than 30 days (3.0 MB).');
});

test('the screen-reader overview names History with its bytes, and says nothing where there is none', () => {
  const base = {
    sessions: { bytes: 1024, count: 1, sizes: {}, list: [] }, images: { bytes: 0, count: 0, list: [] }, cache: { bytes: 0 },
    previews: { bytes: 0, count: 0, available: false }, pins: { bytes: 0, count: 0 },
    speech: { bytes: 0, files: 0 }, upscale: { bytes: 0, files: 0 }, matte: { bytes: 0, files: 0 }, ocr: { bytes: 0, files: 0 },
    reword: { bytes: 0, files: 0 }, aiDetect: { bytes: 0, files: 0 }, durable: { bytes: 0, files: 0 },
    measured: 1024, hasEstimate: false, usage: null, quota: null, overshoot: false, other: 0, total: 1024,
  } satisfies StorageModel;
  assert.doesNotMatch(reconciliationSentence(base), /History/);
  assert.match(reconciliationSentence({ ...base, history: { checkpoints: 1024, previews: 1024, recovery: 0 } }), /History 2\.0 KB/);
});

test('the Storage card measures history, shows the row only where history exists, and wires both actions', () => {
  assert.match(STORAGE_SRC, /host\.state\.history \? await host\.state\.history\.usage\(\)/, 'measured from the revision store');
  assert.match(STORAGE_SRC, /fileHistory\.bytes \+ historyBytes\(history\)/, 'counted in the measured total, so it is not "Other"');
  assert.match(STORAGE_SRC, /\$\{m\.history \? `<div class="store-manage store-manage--row" data-cat="history">/, 'no row without a revision store');
  assert.match(STORAGE_SRC, /<a class="btn" href="#\/history">\$\{t\('Open History'\)\}<\/a>/);
  assert.match(STORAGE_SRC, /id="prune-history-btn"[^>]*>\$\{t\('Remove automatic checkpoints older than 30 days'\)\}/);
  const handler = STORAGE_SRC.slice(STORAGE_SRC.indexOf("closest<HTMLButtonElement>('#prune-history-btn')"), STORAGE_SRC.indexOf("closest('.store-selbar-clear')"));
  assert.match(handler, /history\.pruneAutomatic\(\)/);
  assert.match(handler, /announce\(pruneOutcome\(removed, bytes\)\)/);
  assert.match(handler, /await refreshMeter\(\)/, 'the meter and the row update after a removal');
  assert.match(STORAGE_SRC, /setText\('\[data-history-parts\]', historyParts\(m\.history\)\)/, 'the breakdown updates with the meter');
  assert.match(STORAGE_SRC, /\['history', historyBytes\(m\.history\), t\('History'\), !!m\.history\]/, 'a slice of the bar and a legend chip');
});
