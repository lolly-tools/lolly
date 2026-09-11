// SPDX-License-Identifier: MPL-2.0
/**
 * Run-level PRINT settings for the batch grid - bleed, print marks and the CMYK
 * press profile - and the one rule that makes them safe: a row that carries its
 * own value beats the run-level default.
 *
 * Three surfaces, one rule, so all three are pinned here together:
 *   - `resolvePrintSettings` (pro/batch.ts) - what `runBatch` applies per row;
 *   - `snapshotFromState` / `rowsFromSnapshot` (pro/sessions.ts) - the persistence
 *     channel, run level AND per row;
 *   - `rowFromBatchRow` (pro/folder-rows.ts) - a saved batch flattened into a
 *     folder export, which used to drop all three (plans/65-preflight-and-cost.md section 7).
 *
 * The empty string is deliberately tested as ABSENT, not as "explicitly off": `''`
 * is exactly what the single-tool export panel writes for these fields when its
 * print card is switched off, and an absent field must never read as an asserted zero.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePrintSettings, printSettingsFor } from './batch.ts';
import { snapshotFromState, rowsFromSnapshot, type SessionRow } from './sessions.ts';
import { rowFromBatchRow } from './folder-rows.ts';

const RUN = { profile: 'fogra39', bleed: '3mm', marks: 'crop,reg,bleed,prov' };

// ── resolvePrintSettings: the precedence rule itself ─────────────────────────

test('a row with no print settings inherits every run-level value', () => {
  assert.deepEqual(resolvePrintSettings({}, RUN), RUN);
});

test('a per-row value beats the run-level default', () => {
  const got = resolvePrintSettings({ bleed: '5mm' }, RUN);
  assert.equal(got.bleed, '5mm');
  assert.equal(got.profile, 'fogra39');       // the ones it did not set still inherit
  assert.equal(got.marks, 'crop,reg,bleed,prov');
});

test('each of the three overrides independently', () => {
  assert.equal(resolvePrintSettings({ profile: 'swop' }, RUN).profile, 'swop');
  assert.equal(resolvePrintSettings({ marks: 'crop' }, RUN).marks, 'crop');
  assert.deepEqual(resolvePrintSettings({ profile: 'swop', bleed: '0.125in', marks: 'crop' }, RUN), {
    profile: 'swop', bleed: '0.125in', marks: 'crop',
  });
});

test('an empty per-row string is absent, not an assertion of "no bleed"', () => {
  // '' is what the export panel writes when its print card is off - a session
  // saved that way must inherit the run, not silently cancel it.
  assert.deepEqual(resolvePrintSettings({ profile: '', bleed: '', marks: '' }, RUN), RUN);
});

test('no run-level defaults leaves the row exactly as it is', () => {
  assert.deepEqual(resolvePrintSettings({ bleed: '3mm' }), { profile: undefined, bleed: '3mm', marks: undefined });
  assert.deepEqual(resolvePrintSettings({}), { profile: undefined, bleed: undefined, marks: undefined });
});

// ── The FORMAT gate: print settings only reach a format that prints ──────────
//
// The gate is not a tidy-up. `renderRowToBlob` turns these three into export opts for
// EVERY format, and the export bridge builds the signed C2PA `c2pa.edited` action out
// of those opts - so before the gate a PNG rendered under a run-level 3mm bleed shipped
// a signed claim that bleed and crop marks were applied, when the raster path applies
// neither, and its recreate URL carried the print params too.

test('a print format receives the run-level settings, exactly as before', () => {
  for (const fmt of ['pdf', 'pdf-cmyk', 'cmyk-tiff']) {
    assert.deepEqual(printSettingsFor({}, RUN, fmt), RUN, fmt);
    assert.deepEqual(printSettingsFor({ format: fmt }, RUN, 'png'), RUN, `row ${fmt}`);
  }
});

test('a non-print format receives NOTHING - not the run-level values, not the row\'s own', () => {
  const none = { profile: undefined, bleed: undefined, marks: undefined };
  for (const fmt of ['png', 'jpeg', 'svg', 'webm', 'gif']) {
    assert.deepEqual(printSettingsFor({}, RUN, fmt), none, fmt);
    // The Print button hides when the format leaves print but deliberately does not
    // clear the settings, and a row inherited from a snapshot carries its own - both
    // must be gated, or a batch of PNGs still ships the false claim.
    assert.deepEqual(printSettingsFor({ bleed: '5mm', profile: 'swop', marks: 'crop' }, RUN, fmt), none, `row-level ${fmt}`);
  }
});

test('a row overriding the run format to PNG is gated on the ROW\'s format', () => {
  // chooseFormat can also degrade pdf-cmyk → png per tool; that last gap is closed in
  // render-export.ts, not here (see printSettingsFor's note).
  assert.deepEqual(printSettingsFor({ format: 'png' }, RUN, 'pdf-cmyk'), {
    profile: undefined, bleed: undefined, marks: undefined,
  });
});

test('an unresolvable format keeps the ROW\'s own settings and never the run\'s', () => {
  // The folder/selection paths pass no run format at all - the tool's native format is
  // chosen later. A value attached to one row is evidence; a toolbar default is not.
  assert.deepEqual(printSettingsFor({ bleed: '5mm' }, RUN, undefined), {
    profile: undefined, bleed: '5mm', marks: undefined,
  });
  assert.deepEqual(printSettingsFor({}, RUN, undefined), {
    profile: undefined, bleed: undefined, marks: undefined,
  });
});

// ── Snapshot round trip ──────────────────────────────────────────────────────

const stateWith = (rows: SessionRow[], print: Partial<typeof RUN> = RUN) => ({
  format: 'pdf-cmyk', unit: 'mm', dpi: 300, zipName: '', collapsed: [], colWidths: {},
  ...print, rows,
});

test('a snapshot round-trips the run-level print settings', () => {
  const snap = snapshotFromState(stateWith([{ toolId: 'qr-code', values: {}, manifest: null }]));
  assert.equal(snap.profile, 'fogra39');
  assert.equal(snap.bleed, '3mm');
  assert.equal(snap.marks, 'crop,reg,bleed,prov');
});

test('a snapshot round-trips per-row print settings', () => {
  const snap = snapshotFromState(stateWith([
    { toolId: 'qr-code', values: {}, manifest: null, bleed: '5mm', profile: 'swop', marks: 'crop' },
  ]));
  assert.equal(snap.rows[0]!.bleed, '5mm');
  assert.equal(snap.rows[0]!.profile, 'swop');
  assert.equal(snap.rows[0]!.marks, 'crop');
});

test('a batch with no print settings writes none (old snapshots stay byte-identical)', () => {
  const snap = snapshotFromState(stateWith([{ toolId: 'qr-code', values: {}, manifest: null }], {}));
  assert.equal('profile' in snap, false);
  assert.equal('bleed' in snap, false);
  assert.equal('marks' in snap, false);
});

test('reloading a snapshot restores each row\'s own print settings', async () => {
  const snap = snapshotFromState(stateWith([
    { toolId: 'no-such-tool', values: {}, manifest: null, bleed: '5mm', profile: 'swop', marks: 'crop' },
  ]));
  // newRow() is the caller's factory; the manifest reload fails for an unknown
  // tool (which clears toolId) but must not lose what the row declared.
  const rows = await rowsFromSnapshot(snap, { newRow: (): SessionRow => ({ toolId: '', values: {}, manifest: null }) });
  assert.equal(rows[0]!.bleed, '5mm');
  assert.equal(rows[0]!.profile, 'swop');
  assert.equal(rows[0]!.marks, 'crop');
});

// ── The saved batch → folder export path (section 7's gap) ──────────────────────────

test('a snapshot row inherits the snapshot\'s run-level print settings', () => {
  const row = rowFromBatchRow({ toolId: 'qr-code' }, ['Group', 'Batch'], RUN);
  assert.equal(row.profile, 'fogra39');
  assert.equal(row.bleed, '3mm');
  assert.equal(row.marks, 'crop,reg,bleed,prov');
});

test('a snapshot row\'s own print settings beat the run-level ones', () => {
  const row = rowFromBatchRow({ toolId: 'qr-code', bleed: '5mm' }, ['Group', 'Batch'], RUN);
  assert.equal(row.bleed, '5mm');
  assert.equal(row.profile, 'fogra39');
});

test('folder rows and runBatch resolve print settings identically', () => {
  // Two modules restate the merge (folder-rows.ts imports nothing on purpose);
  // this is the guard that they cannot drift apart.
  for (const row of [{}, { bleed: '5mm' }, { profile: 'swop', marks: '' }, { profile: '', bleed: '', marks: '' }]) {
    const viaFolder = rowFromBatchRow({ toolId: 'qr-code', ...row }, ['g'], RUN);
    const viaRunner = resolvePrintSettings(row, RUN);
    assert.deepEqual(
      { profile: viaFolder.profile, bleed: viaFolder.bleed, marks: viaFolder.marks },
      viaRunner,
    );
  }
});

test('a snapshot row with no run-level defaults carries nothing', () => {
  const row = rowFromBatchRow({ toolId: 'qr-code' }, ['g']);
  assert.equal(row.profile, undefined);
  assert.equal(row.bleed, undefined);
  assert.equal(row.marks, undefined);
});
