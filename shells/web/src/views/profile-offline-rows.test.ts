// SPDX-License-Identifier: MPL-2.0
/**
 * Profile > Available offline: the model rows read lib/model-parts.ts, so a part the
 * model host serves gets its Download button even when the build has no
 * precache.json (a dev server, `tauri dev`), and no row prints "~0 B".
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-offline-rows.test.ts
 *
 * The row decision is the pure views/profile/offline-rows.ts, fed here by the real
 * model-parts module with its host probe stubbed; the wiring into offline.ts is a
 * source pin, the profile-offline-job.test.ts convention.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { partRowState } from './profile/offline-rows.ts';
import { __setModelPartsDepsForTest, modelPartsInfo, MODEL_PART_IDS } from '../lib/model-parts.ts';

const OFFLINE_SRC = readFileSync(new URL('./profile/offline.ts', import.meta.url), 'utf8');

afterEach(() => { __setModelPartsDepsForTest(); });

const rowFor = (i: { available: boolean; allowed: boolean; bytes?: number; ready: boolean | 'unknown' }) => partRowState({
  allowed: i.allowed, available: i.available, stale: false, ready: i.ready === true, planned: i.bytes ?? 0,
});

test('a part served only by the models listing renders a Download with its size', async () => {
  __setModelPartsDepsForTest({ probe: async () => true, ready: async () => false, records: async () => ({}) });
  const infos = await modelPartsInfo(MODEL_PART_IDS, { precache: null });
  for (const info of infos) {
    const row = rowFor(info);
    assert.equal(row.dl.hidden, false, `${info.id} shows its button`);
    assert.equal(row.dl.text, 'Download');
    assert.notEqual(row.sub, 'Not available to download here');
    assert.match(row.sub, /\d+(\.\d)? (KB|MB|GB)/, `${info.id} states its size on the row line`);
    assert.doesNotMatch(row.sub, /\b0 B/);
  }
});

test('a part the host does not serve says so, with no button', async () => {
  __setModelPartsDepsForTest({ probe: async () => false, ready: async () => false, records: async () => ({}) });
  const [ocr] = await modelPartsInfo(['ocr'], { precache: null });
  const row = rowFor(ocr!);
  assert.equal(row.sub, 'Not available to download here');
  assert.equal(row.dl.hidden, true);
});

test('a model fetched on first use reads as on this device, removable, with no Download', () => {
  const row = partRowState({ allowed: true, available: true, stale: false, ready: true, planned: 0 });
  assert.equal(row.sub, 'On this device');
  assert.equal(row.dl.disabled, true);
  assert.equal(row.rm.hidden, false);
});

test('downloaded, update, and policy states', () => {
  const rec = { at: '', version: 'a', bytes: 2048, files: 1 };
  assert.equal(partRowState({ allowed: true, available: true, rec, stale: false, ready: true, planned: 0 }).dl.text, 'Downloaded');
  const stale = partRowState({ allowed: true, available: true, rec, stale: true, ready: true, planned: 100 });
  assert.equal(stale.dl.text, 'Update');
  assert.equal(stale.dl.disabled, false);
  const gone = partRowState({ allowed: true, available: false, rec, stale: true, ready: true, planned: 100 });
  assert.equal(gone.dl.disabled, true, 'an update the server cannot serve is not offered');
  assert.equal(gone.rm.hidden, false, 'but the download can still be removed');
  const policy = partRowState({ allowed: false, available: true, stale: false, ready: false, planned: 100 });
  assert.equal(policy.sub, 'AI downloads are disabled by your service policy.');
  assert.equal(policy.dl.hidden, true);
  assert.equal(partRowState({ allowed: true, available: true, stale: false, ready: false, planned: 0 }).sub, '', 'an unknown size prints nothing');
});

test('offline.ts reads the model rows from model-parts and quotes no size in its descriptions', () => {
  assert.match(OFFLINE_SRC, /modelPartsInfo\(MODEL_PART_IDS, \{ precache, records: parts \}\)/);
  assert.match(OFFLINE_SRC, /downloadModelPart\(id, precache, \{ signal, onProgress \}\)/, 'Profile runs the same downloader as the offer');
  assert.match(OFFLINE_SRC, /partRowState\(\{/);
  assert.doesNotMatch(OFFLINE_SRC, /\(~\{size\}\)/, 'no description quotes "(~{size})"');
  assert.doesNotMatch(OFFLINE_SRC, /!!precache && plannedBytes/, 'availability no longer hangs on precache.json');
  // The heavy models stay out of the plain "Download everything" sweep.
  assert.match(OFFLINE_SRC, /const sweepIds: OfflinePartId\[\] = \['app', 'catalog', 'docs', \.\.\.\(inclModels\(\) \? availableModelParts\(\) : \[\]\)\];/);
});

test('the large-download tag follows the size and the row state, not the part id', () => {
  assert.doesNotMatch(OFFLINE_SRC, /heavy: id !== 'ask'/);
  assert.match(OFFLINE_SRC, /heavy\.hidden = state\.dl\.hidden \|\| state\.dl\.disabled/, 'hidden where nothing is left to download');
  assert.match(OFFLINE_SRC, /fetchPrecacheManifest\(\),/, 'Profile reads precache.json fresh on every open');
});
