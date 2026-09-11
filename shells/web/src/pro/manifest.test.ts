// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the /pro run REPORT - the rows that produced no file, and the
 * `preflight.json` envelope. Run directly:
 *   node --test shells/web/src/pro/manifest.test.ts
 *
 * The subject under test is INDEX IDENTITY. `planBatch` compacts, so every fixture
 * here deliberately drops a row near the top: a report that keys off the runner index
 * would then name every later row one-too-low, which is the shipping defect this
 * module exists to remove.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rowLabel, collectUnmade, buildPreflightReport, preflightJson,
  CANCELLED_REASON, PREFLIGHT_DISCLAIMER,
} from './manifest.ts';
import { creditText } from './zip.ts';

// A five-row job whose SOURCE row 2 (index 1) was skipped before the run, so the
// runner array is four long and runner k maps to source k+1 from there on.
const ROWS = [
  { toolId: 'poster', uid: 'a' },
  { toolId: 'event-badge', filename: 'badge', uid: 'c' },
  { toolId: 'qr-code', uid: 'd' },
  { toolId: 'flyer', uid: 'e' },
];
const SRC_INDEX = [0, 2, 3, 4];
const SKIPPED = [{ row: { toolId: 'promo', uid: 'b' }, reason: 'Render-only tool', srcIndex: 1, uid: 'b' }];

test('rowLabel prefers the filename stem, then the tool id, then says so', () => {
  assert.equal(rowLabel({ toolId: 'qr-code', filename: '  badge  ' }), 'badge');
  assert.equal(rowLabel({ toolId: 'qr-code' }), 'qr-code');
  assert.equal(rowLabel({}), '(no template)');
  assert.equal(rowLabel(undefined), '(no template)');
});

test('a failed row is reported at its SOURCE row number, not its queue position', () => {
  const unmade = collectUnmade({
    rows: ROWS,
    srcIndex: SRC_INDEX,
    // runner index 1 failed - that is source index 2, i.e. the user's row 3.
    results: [
      { index: 0, ok: true, name: '01-poster.png' },
      { index: 1, ok: false, error: 'Render timed out after 10s' },
      { index: 2, ok: true, name: '03-qr-code.png' },
      { index: 3, ok: true, name: '04-flyer.png' },
    ],
    skipped: SKIPPED,
  });
  const failed = unmade.find(u => u.state === 'failed')!;
  assert.equal(failed.row, 3, 'source row number, not runner index + 1 (which would be 2)');
  assert.equal(failed.runIndex, 1);
  assert.equal(failed.label, 'badge');
  assert.equal(failed.uid, 'c');
  assert.equal(failed.reason, 'Render timed out after 10s');
});

test('a skipped row keeps the source position planBatch captured, and no queue position', () => {
  const unmade = collectUnmade({ rows: ROWS, srcIndex: SRC_INDEX, results: [], skipped: SKIPPED });
  const skipped = unmade.find(u => u.state === 'skipped')!;
  assert.equal(skipped.row, 2);
  assert.equal(skipped.runIndex, null, 'never entered the runner, so it has no position in it');
  assert.equal(skipped.reason, 'Render-only tool');
});

test('rows the run never reached are recorded as cancelled, not as failures', () => {
  const unmade = collectUnmade({
    rows: ROWS,
    srcIndex: SRC_INDEX,
    results: [{ index: 0, ok: true, name: '01-poster.png' }],   // cancelled after row 1
    skipped: SKIPPED,
  });
  const cancelled = unmade.filter(u => u.state === 'cancelled');
  assert.deepEqual(cancelled.map(u => u.row), [3, 4, 5]);
  assert.equal(cancelled[0]!.reason, CANCELLED_REASON);
  assert.equal(unmade.filter(u => u.state === 'failed').length, 0);
  // Ordered by the number a person can point at, skipped row included.
  assert.deepEqual(unmade.map(u => u.row), [2, 3, 4, 5]);
});

test('with no srcIndex, runner space is treated as source space', () => {
  const unmade = collectUnmade({ rows: ROWS, results: [{ index: 2, ok: false, error: 'boom' }] });
  assert.equal(unmade.find(u => u.state === 'failed')!.row, 3);
});

test('per-row notes are attached by runner index and flattened by the caller', () => {
  const unmade = collectUnmade({
    rows: ROWS,
    srcIndex: SRC_INDEX,
    results: [{ index: 1, ok: false, error: 'boom' }],
    noteLines: (k) => (k === 1 ? ['No bleed set'] : []),
  });
  assert.deepEqual(unmade.find(u => u.state === 'failed')!.notes, ['No bleed set']);
});

// ── The sidecar ────────────────────────────────────────────────────────────────

const REPORT = () => buildPreflightReport({
  rows: ROWS,
  srcIndex: SRC_INDEX,
  results: [
    { index: 0, ok: true, name: '01-poster.png' },
    { index: 1, ok: false, error: 'Render timed out after 10s' },
    { index: 2, ok: true, name: '03-qr-code.png' },
    { index: 3, ok: true, name: '04-flyer.png' },
  ],
  skipped: SKIPPED,
  zipName: 'lolly-batch.zip',
  engine: '1.92.0',
  generated: '2026-07-31T14:22:03.000Z',
  findings: (k) => (k === 0 ? [{ id: 'print.no-bleed', severity: 'info' }] : []),
});

test('preflight.json states every row exactly once, in source order', () => {
  const r = REPORT();
  assert.equal(r.schema, 'lolly.preflight/1');
  assert.equal(r.job.rowsRequested, 5);
  assert.equal(r.job.rowsRendered, 3);
  assert.deepEqual(r.rows.map(x => x.row), [1, 2, 3, 4, 5]);
  assert.deepEqual(r.rows.map(x => x.state), ['rendered', 'skipped', 'failed', 'rendered', 'rendered']);
  // row / runIndex / file together ARE the index-identity contract.
  assert.deepEqual(
    r.rows.map(x => [x.row, x.runIndex, x.file]),
    [[1, 0, '01-poster.png'], [2, null, null], [3, 1, null], [4, 2, '03-qr-code.png'], [5, 3, '04-flyer.png']],
  );
});

test('preflight.json carries the opaque findings payload verbatim', () => {
  const r = REPORT();
  assert.deepEqual(r.rows[0]!.findings, [{ id: 'print.no-bleed', severity: 'info' }]);
  assert.deepEqual(r.rows[1]!.findings, [], 'nothing was supplied for the skipped row');
});

test('a SKIPPED row\'s findings reach the report, keyed by identity', () => {
  // The case plan section 7 says preflight most exists for. A skipped row has no runner
  // index, so the positional channel structurally cannot carry it; without the
  // identity channel `collect.row-not-rendered` was computed on every run and deleted
  // on every run, and preflight.json said {"state":"skipped","findings":[]}.
  const r = buildPreflightReport({
    rows: ROWS, srcIndex: SRC_INDEX, results: [], skipped: SKIPPED,
    zipName: 'z.zip', engine: '1.92.0',
    skippedFindings: [{ uid: 'b', srcIndex: 1, items: [{ id: 'collect.row-not-rendered', severity: 'info' }] }],
  });
  const skippedRow = r.rows.find(x => x.state === 'skipped')!;
  assert.equal(skippedRow.row, 2);
  assert.deepEqual(skippedRow.findings, [{ id: 'collect.row-not-rendered', severity: 'info' }]);
});

test('a skipped row with no uid is matched on its source row number', () => {
  const r = buildPreflightReport({
    rows: ROWS, srcIndex: SRC_INDEX, results: [],
    skipped: [{ row: { toolId: 'promo' }, reason: 'Render-only tool', srcIndex: 1 }],
    zipName: 'z.zip', engine: '1.92.0',
    skippedFindings: [{ srcIndex: 1, items: [{ id: 'collect.row-not-rendered' }] }],
  });
  assert.deepEqual(r.rows.find(x => x.state === 'skipped')!.findings, [{ id: 'collect.row-not-rendered' }]);
});

test('run-level findings are stated once in the envelope, never against a row', () => {
  const r = buildPreflightReport({
    rows: ROWS, srcIndex: SRC_INDEX, results: [{ index: 0, ok: true, name: '01-poster.png' }],
    zipName: 'z.zip', engine: '1.92.0',
    runFindings: [{ id: 'refuse.output-file-size', severity: 'info' }],
  });
  assert.deepEqual(r.runFindings, [{ id: 'refuse.output-file-size', severity: 'info' }]);
  for (const row of r.rows) {
    assert.equal(row.findings.some((f: any) => f.id === 'refuse.output-file-size'), false);
  }
  assert.ok('runFindings' in JSON.parse(preflightJson(r)));
});

test('the money fields ship as null from Phase 2 so no consumer can read an absent one as zero', () => {
  const r = REPORT();
  assert.equal(r.kind, 'counts-only');
  assert.equal(r.isQuote, false);
  assert.equal(r.estimatedTotalFromSuppliedRates, null);
  assert.equal(r.ratesFrom, null);
  assert.equal(r.disclaimer, PREFLIGHT_DISCLAIMER);
  // Present as an explicit null in the SERIALIZED form too - a dropped key would be
  // indistinguishable from a consumer that never learned to look.
  const json = JSON.parse(preflightJson(r));
  assert.ok('estimatedTotalFromSuppliedRates' in json);
  assert.equal(json.estimatedTotalFromSuppliedRates, null);
});

test('a retry names the package it retries', () => {
  const r = buildPreflightReport({
    rows: [ROWS[1]!], srcIndex: [2], results: [{ index: 0, ok: true, name: '01-badge.png' }],
    zipName: 'lolly-batch-retry.zip', engine: '1.92.0', retryOf: 'lolly-batch.zip',
  });
  assert.equal(r.job.retryOf, 'lolly-batch.zip');
  assert.equal(r.rows[0]!.row, 3, 'a retried row keeps its original source number');
});

// ── The human manifest ─────────────────────────────────────────────────────────

test('lolly.txt records the rows that produced no file', () => {
  const txt = creditText(
    [{ name: '01-poster.png', fmt: 'png', ms: 900 }],
    {
      zipName: 'lolly-batch.zip',
      unmade: [
        { row: 3, runIndex: 1, label: 'badge', state: 'failed', reason: 'Render timed out after 10s' },
        { row: 2, runIndex: null, label: 'promo', state: 'skipped', reason: 'Render-only tool' },
      ],
    },
  );
  // The fact line sits under the timestamp so a skimmer cannot miss it…
  assert.match(txt, /2 of 3 rows produced no file - listed below\./);
  // …and the block itself carries the caveat as a sibling of the list, not UI chrome.
  assert.match(txt, /\[ 2 rows produced no file \]/);
  assert.match(txt, /These rows were part of this job and are not in this zip\./);
  assert.match(txt, /row 3\s+badge\s+\|\s+Failed\s+·\s+Render timed out after 10s/);
  assert.match(txt, /row 2\s+promo\s+\|\s+Skipped\s+·\s+Render-only tool/);
});

test('lolly.txt is byte-identical when every row produced a file', () => {
  const files = [{ name: '01-poster.png', fmt: 'png', ms: 900 }];
  assert.equal(creditText(files, { zipName: 'x.zip' }), creditText(files, { zipName: 'x.zip', unmade: [], noted: [] }));
  assert.doesNotMatch(creditText(files, { zipName: 'x.zip' }), /produced no file/);
});

test('notes on a rendered file are a [ Notes ] block, and never read as damage', () => {
  const txt = creditText([{ name: '007-event-badge.pdf', fmt: 'pdf' }], {
    zipName: 'lolly-batch.zip',
    noted: [{ name: '007-event-badge.pdf', lines: ['No bleed set; the trim box and the media box are the same size.'] }],
  });
  assert.match(txt, /\[ Notes \]/);
  assert.match(txt, /They do not mean the file is wrong\./);
  assert.match(txt, /## 007-event-badge\.pdf\nℹ No bleed set/);
  assert.doesNotMatch(txt, /warning/i);
});

test('a run-level note is stated once, above the per-file notes', () => {
  // Not repeated under every filename: a 500-row batch would otherwise carry the same
  // sentence 500 times, which is how a real finding stops being read.
  const txt = creditText([{ name: '01-a.png' }, { name: '02-b.png' }], {
    zipName: 'lolly-batch.zip',
    runNotes: ['Lolly cannot predict the output file size.'],
    noted: [{ name: '02-b.png', lines: ['A required input is blank.'] }],
  });
  assert.match(txt, /\[ Notes \]/);
  assert.match(txt, /## This run\nℹ Lolly cannot predict the output file size\./);
  assert.equal(txt.split('Lolly cannot predict').length - 1, 1);
  // The run block leads; the per-file block follows.
  assert.ok(txt.indexOf('## This run') < txt.indexOf('## 02-b.png'));
});

test('run-level notes alone still open the block', () => {
  const txt = creditText([{ name: '01-a.png' }], { zipName: 'z.zip', runNotes: ['One fact about the run.'] });
  assert.match(txt, /\[ Notes \]/);
  assert.match(txt, /## This run/);
});

test('a retry manifest names the original package', () => {
  const txt = creditText([{ name: '01-badge.png' }], { zipName: 'b-retry.zip', retryOf: 'b.zip' });
  assert.match(txt, /\[ This is a retry \]/);
  assert.match(txt, /rows that failed in b\.zip/);
});
