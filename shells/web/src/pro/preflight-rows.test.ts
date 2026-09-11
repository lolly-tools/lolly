// SPDX-License-Identifier: MPL-2.0
/**
 * The BATCH PREFLIGHT COLLECTOR - `pro/preflight-rows.ts`, against the real engine.
 *
 * The engine's rules are tested in `tests/preflight.test.ts`; nothing here re-tests
 * a rule. What is tested here is the COLLECTION: that the job handed to the engine
 * describes the render that is actually about to happen.
 *
 * The essential property is SETTINGS PARITY. A preflight that checks settings
 * the renderer will not use is worse than none, so the parity test restates
 * `runBatch`'s own two-level resolution independently (quoted from `batch.ts`) and
 * pins the collector to it - a drift in either direction fails here rather than
 * shipping a confident report about a job nobody ran.
 *
 * The other three cases are the ones plan section 7 names: a clean row, a row with a
 * finding, and a SKIPPED row, which has no queue position at all and is exactly the
 * case preflight most needs to explain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planBatch, printSettingsFor, type BatchRow } from './batch.ts';
import {
  RUN_LEVEL_IDS, createBatchRowCheck, preflightJobForRow, preflightRow, rowSize,
  skippedFindings, toPreflightManifest, type BatchPreflightEnv,
} from './preflight-rows.ts';
import { RASTER_DEFAULT_SCALE } from '../bridge/export-scale.ts';
import type { Finding } from '@lolly/engine';

/** A minimal exportable manifest. `as never` only at the call boundary. */
const manifestOf = (over: Record<string, unknown> = {}) => ({
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  render: { width: 1200, height: 900, formats: ['png', 'pdf'], ...(over.render as object ?? {}) },
  inputs: (over.inputs as unknown[]) ?? [{ id: 'title', label: 'Title', type: 'text', default: 'hi' }],
  ...(over.status ? { status: over.status } : {}),
}) as never;

const ENV: BatchPreflightEnv = {
  run: {},
  // Never a fabricated empty palette: an unresolved brand is a named refusal, and
  // the engine withholds the plate ceiling because of it.
  palette: { known: false, why: 'not-resolved' },
  source: 'test',
};

const CTX = { srcIndex: 0 };

test('a clean row produces NOTHING - not one note, not one refusal', () => {
  // The per-row channel is a claim about THIS row. `refuse.output-file-size` fires on
  // every job ever, so left in here it put a chip on all 50 cards of a clean 50-row
  // batch and made the headline read "50 with notes" - the noise plan section 6 names.
  // svg: no pixel count to report, so a clean row has genuinely nothing to say.
  const m = toPreflightManifest(manifestOf({ render: { width: 1200, height: 900, formats: ['svg'] } }));
  assert.deepEqual(preflightRow({ toolId: 'demo', values: { title: 'hello' } }, m, 0, CTX, ENV), []);
  // png: the ONLY thing a clean raster row carries is its own count. No refusals.
  const png = preflightRow({ toolId: 'demo', values: { title: 'hello' }, format: 'png' }, toPreflightManifest(manifestOf()), 0, CTX, ENV);
  assert.deepEqual(png.map(f => f.id), ['count.raster-pixels'],
    `a clean row carries its counts and nothing else, got ${JSON.stringify(png.map(f => f.id))}`);
});

test('the run-invariant findings are not dropped - they are handed to the run channel', () => {
  const runLevel: Finding[] = [];
  const row: BatchRow = { toolId: 'demo', values: { title: 'hello' }, format: 'png' };
  preflightRow(row, toPreflightManifest(manifestOf()), 0, CTX, ENV, f => runLevel.push(f));
  assert.ok(runLevel.some(f => f.id === 'refuse.output-file-size'),
    'the platform refusal still exists; it is emitted once, at run level');
  for (const f of runLevel) assert.ok(RUN_LEVEL_IDS.has(f.id));
});

test('the job reports the stage as UNAVAILABLE, never as an empty stage', () => {
  const job = preflightJobForRow({ toolId: 'demo', values: {} }, toPreflightManifest(manifestOf()), 0, CTX, ENV);
  // The whole Tier-1 contract in one assertion: a pre-pass has no mounted node, and
  // an all-false StageFacts would make every stage-derived check silently pass.
  assert.deepEqual(job.stage, { known: false, why: 'needs-mount' });
  // No runtime ran, so no hook has patched anything. Said out loud, not implied.
  assert.equal(job.modelPhase, 'declared');
  assert.deepEqual(job.rawInitial, {});
});

test('a row with a problem carries the finding', () => {
  const m = manifestOf({ inputs: [{ id: 'title', label: 'Title', type: 'text', required: true }] });
  const row: BatchRow = { toolId: 'demo', values: {}, format: 'png' };
  const findings = preflightRow(row, toPreflightManifest(m), 0, CTX, ENV);
  const blank = findings.find(f => f.id === 'input.required-blank');
  assert.ok(blank, `expected input.required-blank, got ${JSON.stringify(findings.map(f => f.id))}`);
  assert.equal(blank!.severity, 'warn');
  assert.equal(blank!.inputId, 'title');
});

test('bindToProfile prefill is threaded in, so a pre-filled required input is not reported blank', () => {
  const m = manifestOf({ inputs: [{ id: 'name', label: 'Name', type: 'text', required: true, bindToProfile: 'firstname' }] });
  const withProfile = { ...ENV, profile: { firstname: 'Andy' } };
  const findings = preflightRow({ toolId: 'demo', values: {} }, toPreflightManifest(m), 0, CTX, withProfile);
  assert.equal(findings.some(f => f.id === 'input.required-blank'), false);
});

test('every finding is stamped with the SOURCE row, the only number a human can find', () => {
  const m = manifestOf({ inputs: [{ id: 'title', label: 'Title', type: 'text', required: true }] });
  // Queue position 2, source position 7: they are different index spaces, and the
  // one written into the artifact is the source position.
  const findings = preflightRow({ toolId: 'demo', values: {} }, toPreflightManifest(m), 2, { srcIndex: 7 }, ENV);
  for (const f of findings) assert.equal(f.rowIndex, 7);
});

// ── Skipped rows ────────────────────────────────────────────────────────────
//
// A skipped row has no queue position (`rowIndex: -1`) but IS the case preflight
// most needs to explain, so it must still be able to carry findings.

test('a skipped row with no loadable template still carries a finding', () => {
  const findings = preflightRow(
    { toolId: '', values: {} }, null, -1,
    { srcIndex: 3, skippedReason: 'No template selected' }, ENV,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.id, 'collect.row-not-rendered');
  // The gap invariant, held by hand for a collector-side caveat: info, no count.
  assert.equal(findings[0]!.severity, 'info');
  assert.equal(findings[0]!.needs, 'not-carried');
  assert.equal(findings[0]!.count, undefined);
  assert.equal(findings[0]!.rowIndex, 3);
  assert.match(findings[0]!.message, /No template selected/);
});

test('a skipped row that DID load carries the caveat plus the engine findings', () => {
  const m = manifestOf({ render: { width: 1200, height: 900, formats: ['png'], export: false } });
  const findings = preflightRow(
    { toolId: 'demo', values: {} }, toPreflightManifest(m), -1,
    { srcIndex: 4, skippedReason: 'Render-only tool' }, ENV,
  );
  assert.equal(findings[0]!.id, 'collect.row-not-rendered');
  assert.ok(findings.length > 1, 'a render-only row still gets the engine report');
});

test('planBatch routes a skipped row through the check with rowIndex -1', async () => {
  const seen: Array<{ rowIndex: number; srcIndex: number; reason?: string }> = [];
  const plan = await planBatch<Finding>(
    [{ toolId: '', values: {} }, { toolId: 'demo', values: {} }],
    {
      getTool: async () => ({ manifest: manifestOf() }),
      isExportable: () => true,
      check: (row, rowIndex, ctx) => {
        seen.push({ rowIndex, srcIndex: ctx.srcIndex, reason: ctx.skippedReason });
        return preflightRow(row, row.toolId ? toPreflightManifest(manifestOf()) : null, rowIndex, ctx, ENV);
      },
    },
  );
  assert.deepEqual(seen, [
    { rowIndex: -1, srcIndex: 0, reason: 'No template selected' },
    { rowIndex: 0, srcIndex: 1, reason: undefined },
  ]);
  // The dropped row's findings ride the plan keyed by -1, so `notesFromFindings`
  // drops them from the runner's channel and the run REPORT keeps them.
  const dropped = plan.findings.find(f => f.rowIndex === -1);
  assert.ok(dropped, 'the skipped row carries findings');
  assert.equal(dropped!.items[0]!.id, 'collect.row-not-rendered');
});

// ── Settings parity ─────────────────────────────────────────────────────────

test('the job carries the settings runBatch would render with (row beats run)', () => {
  const run = { format: 'png', unit: 'mm', dpi: 150, profile: 'fogra39', bleed: '3mm', marks: 'crop,reg' };
  const row: BatchRow = {
    toolId: 'demo', values: {},
    format: 'pdf', outWidth: 210, outHeight: 297, unit: 'mm', dpi: 600,
    bleed: '5mm', filename: 'poster',
  };
  const job = preflightJobForRow(row, toPreflightManifest(manifestOf()), 0, CTX, { ...ENV, run });

  // batch.ts:317 - `printSettingsFor(row, { profile, bleed, marks }, format)`. The
  // collector calls the GATE itself, so this is the renderer's own answer.
  const print = printSettingsFor(row, { profile: run.profile, bleed: run.bleed, marks: run.marks }, run.format);
  assert.deepEqual(print, { profile: 'fogra39', bleed: '5mm', marks: 'crop,reg' });
  assert.deepEqual(job.settings.bleed, { known: true, value: { value: 5, unit: 'mm' } });
  assert.deepEqual(job.settings.pressProfile, { known: true, value: 'fogra39' });
  assert.deepEqual(job.settings.marks, {
    known: true,
    value: { crop: true, registration: true, bleed: false, colorBars: false, provenance: false },
  });

  // runBatch's own two lines, restated independently:
  //   const rowUnit = row.unit ?? unit ?? 'px';
  //   const rowDpi  = rowUnit === 'px' ? undefined : (row.dpi ?? dpi ?? 300);
  const rowUnit = row.unit ?? run.unit ?? 'px';
  const rowDpi = rowUnit === 'px' ? undefined : (row.dpi ?? run.dpi ?? 300);
  assert.equal(job.settings.size.width.unit, rowUnit);
  assert.equal(job.settings.size.dpi, rowDpi);
  assert.deepEqual(job.settings.size.width, { value: 210, unit: 'mm' });
  assert.equal(job.settings.size.declaredBy, 'row');
  assert.equal(job.settings.size.unitDeclared, true);
  // `chooseFormat(manifest, row.format || run.format)` - the row's own wins.
  assert.equal(job.settings.format, 'pdf');
  assert.equal(job.settings.filename, 'poster');
});

test('a non-print format is handed NO print settings, exactly as the render gate strips them', () => {
  const run = { format: 'png', bleed: '3mm', marks: 'crop', profile: 'fogra39' };
  const row: BatchRow = { toolId: 'demo', values: {} };
  const job = preflightJobForRow(row, toPreflightManifest(manifestOf()), 0, CTX, { ...ENV, run });
  // Known NULL, not unknown: the render applies none, and that is a fact.
  assert.deepEqual(job.settings.bleed, { known: true, value: null });
  assert.deepEqual(job.settings.marks, { known: true, value: null });
  assert.deepEqual(job.settings.pressProfile, { known: true, value: null });
});

test('no run format and no row format falls through to the tool\'s first declared format', () => {
  // The folder / selection paths: `chooseFormat` picks the native format later, and
  // the collector must pick the same one rather than reporting an empty format.
  const job = preflightJobForRow({ toolId: 'demo', values: {} }, toPreflightManifest(manifestOf()), 0, CTX, ENV);
  assert.equal(job.settings.format, 'png');
});

test('ONE declared dimension is a declaration: the other stays 0, never the manifest', () => {
  // `bothGiven` governs LAYOUT only. `render-export.ts:315-317` builds outW/outH
  // independently, so `width: '210mm'` really does reach the export boundary and the
  // PDF page really is 210mm wide - the CLI's `sizeFacts` shape is the honest one.
  const size = rowSize({ toolId: 'demo', values: {}, outWidth: 210, unit: 'mm' }, toPreflightManifest(manifestOf()), {});
  assert.deepEqual(size.width, { value: 210, unit: 'mm' });
  assert.deepEqual(size.height, { value: 0, unit: 'mm' });
  assert.equal(size.declaredBy, 'row');
  assert.equal(size.unitDeclared, true);
});

test('a half-declared print row gets trim-partially-declared, not two false findings', () => {
  const row: BatchRow = { toolId: 'demo', values: {}, format: 'pdf', outWidth: 210, unit: 'mm' };
  const ids = preflightRow(row, toPreflightManifest(manifestOf()), 0, CTX, ENV).map(f => f.id);
  assert.ok(ids.includes('print.trim-partially-declared'), JSON.stringify(ids));
  // Both of these are statements about a job that DID declare a physical width.
  assert.equal(ids.includes('print.trim-not-physical'), false);
  assert.equal(ids.includes('refuse.trim-when-unset'), false);
});

// ── The supersample the renderer applies, restated ──────────────────────────
//
// `rasterStyle` (bridge/export.ts) in two lines, quoted rather than referenced, so a
// change to the default scale fails HERE rather than shipping a confident wrong count:
//
//   const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
//   const targetW   = requested ? toPixels(d.w, d.dpi) : Math.round(d.node.w * (opts.scale ?? RASTER_DEFAULT_SCALE));
const rasterTargetW = (nodeW: number, requested: boolean, requestedPx: number): number =>
  (requested ? requestedPx : Math.round(nodeW * RASTER_DEFAULT_SCALE));

test('a dimension-less RASTER row reports the pixels rasterStyle will actually produce', () => {
  const m = toPreflightManifest(manifestOf());
  const size = rowSize({ toolId: 'demo', values: {}, format: 'png' }, m, {});
  // renderRowToBlob passes width/height undefined → not requested → node box x scale,
  // and the node box for a dimension-less row IS the manifest canvas (layoutW = nativeW).
  assert.equal(size.width.value, rasterTargetW(1200, false, 0));
  assert.equal(size.height.value, rasterTargetW(900, false, 0));
  assert.equal(size.declaredBy, 'manifest');
});

test('a dimension-less VECTOR row keeps the unscaled canvas - rasterStyle never runs for it', () => {
  const size = rowSize({ toolId: 'demo', values: {}, format: 'pdf' }, toPreflightManifest(manifestOf()), {});
  assert.deepEqual(size.width, { value: 1200, unit: 'px' });
  assert.deepEqual(size.height, { value: 900, unit: 'px' });
});

test('a declared size is honoured verbatim: the supersample applies to no-request rows only', () => {
  const size = rowSize({ toolId: 'demo', values: {}, format: 'png', outWidth: 800, outHeight: 600 }, toPreflightManifest(manifestOf()), {});
  assert.equal(size.width.value, rasterTargetW(1200, true, 800));
  assert.equal(size.height.value, rasterTargetW(900, true, 600));
});

test('the pixel count the engine reports for a default PNG row is the one the file has', () => {
  const findings = preflightRow({ toolId: 'demo', values: { title: 'x' }, format: 'png' }, toPreflightManifest(manifestOf()), 0, CTX, ENV, () => {});
  const px = findings.find(f => f.id === 'count.raster-pixels');
  assert.ok(px, 'a raster row counts its pixels');
  assert.equal(px!.count!.value, (1200 * RASTER_DEFAULT_SCALE) * (900 * RASTER_DEFAULT_SCALE));
  assert.equal(px!.count!.bound, 'exact');
});

// ── Format substitution ─────────────────────────────────────────────────────

test('a format the tool does not offer is reported as SUBSTITUTED, never silently swapped', () => {
  // chooseFormat returns formats[0] with no complaint, which makes the engine's
  // settings.format-not-offered structurally unreachable in a batch.
  const m = manifestOf({ render: { width: 1200, height: 900, formats: ['svg', 'png'] } });
  const row: BatchRow = { toolId: 'demo', values: { title: 'x' } };
  const findings = preflightRow(row, toPreflightManifest(m), 0, CTX, { ...ENV, run: { format: 'pdf' } }, () => {});
  const sub = findings.find(f => f.id === 'collect.format-substituted');
  assert.ok(sub, JSON.stringify(findings.map(f => f.id)));
  assert.equal(sub!.severity, 'warn');
  assert.equal(sub!.evidence!.requested, 'pdf');
  assert.equal(sub!.evidence!.chosen, 'svg');
  assert.equal(sub!.rowIndex, 0);
});

test('a format the tool DOES offer is not a substitution, and neither is jpg/jpeg', () => {
  const m = toPreflightManifest(manifestOf({ render: { width: 10, height: 10, formats: ['jpeg', 'png'] } }));
  const has = (run: Record<string, string>, row: Partial<BatchRow> = {}) =>
    preflightRow({ toolId: 'demo', values: { title: 'x' }, ...row } as BatchRow, m, 0, CTX, { ...ENV, run }, () => {})
      .some(f => f.id === 'collect.format-substituted');
  assert.equal(has({ format: 'png' }), false);
  assert.equal(has({ format: 'jpg' }), false, 'chooseFormat holds the jpg/jpeg equivalence');
});

test('a px fallback is not a declared unit', () => {
  const size = rowSize({ toolId: 'demo', values: {}, outWidth: 800, outHeight: 600 }, toPreflightManifest(manifestOf()), {});
  assert.equal(size.width.unit, 'px');
  assert.equal(size.unitDeclared, false);
  assert.equal(size.dpi, 96);
});

test('an unparseable bleed is UNKNOWN, never "no bleed"', () => {
  const row: BatchRow = { toolId: 'demo', values: {}, format: 'pdf', bleed: 'three millimetres' };
  const job = preflightJobForRow(row, toPreflightManifest(manifestOf()), 0, CTX, ENV);
  assert.deepEqual(job.settings.bleed, { known: false, why: 'not-resolved' });
});

// ── The wiring ──────────────────────────────────────────────────────────────

test('createBatchRowCheck resolves the palette ONCE for the whole run', async () => {
  let calls = 0;
  const host = {
    tokens: { colors: async () => { calls++; return [{ path: 'brand.a', name: 'A', spot: null }]; } },
    profile: { get: async () => ({ firstname: 'Andy' }) },
  };
  const rows: BatchRow[] = [
    { toolId: 'demo', values: {} }, { toolId: 'demo', values: {} }, { toolId: 'demo', values: {} },
  ];
  let loads = 0;
  const { check } = await createBatchRowCheck(rows, host, { format: 'png' }, {
    getTool: async () => { loads++; return { manifest: manifestOf() }; },
  });
  for (let i = 0; i < rows.length; i++) check(rows[i]!, i, { srcIndex: i });
  assert.equal(calls, 1, 'the brand palette is run-invariant: one resolve, not one per row');
  assert.equal(loads, 1, 'one manifest load per DISTINCT template');
});

test('an experimental tool is reported once per row, as info', async () => {
  const rows: BatchRow[] = [{ toolId: 'demo', values: {}, format: 'png' }];
  const { check } = await createBatchRowCheck(rows, {}, {}, {
    getTool: async () => ({ manifest: manifestOf({ status: 'experimental' }) }),
  });
  const out = check(rows[0]!, 0, { srcIndex: 0 });
  const w = out.find((f: Finding) => f.id === 'export.experimental-watermark');
  assert.ok(w);
  assert.equal(w!.severity, 'info');
});

test('a collector that throws costs the findings, never the run', async () => {
  const logged: string[] = [];
  const rows: BatchRow[] = [{ toolId: 'demo', values: {} }];
  const { check } = await createBatchRowCheck(rows, { log: (_l, m) => { logged.push(m); } }, {}, {
    getTool: async () => ({ manifest: manifestOf() }),
  });
  // A row whose `values` getter explodes: the collector swallows it and returns [].
  const hostile = { toolId: 'demo', get values(): Record<string, unknown> { throw new Error('boom'); } } as unknown as BatchRow;
  assert.deepEqual(check(hostile, 0, { srcIndex: 0 }), []);
  assert.equal(logged.length, 1);
});

test('the run-level findings are collected ONCE for the whole run, with no row stamp', async () => {
  const rows: BatchRow[] = [
    { toolId: 'demo', values: { title: 'a' } },
    { toolId: 'demo', values: { title: 'b' } },
    { toolId: 'demo', values: { title: 'c' } },
  ];
  const { check, runFindings } = await createBatchRowCheck(rows, {}, { format: 'svg' }, {
    getTool: async () => ({ manifest: manifestOf({ render: { width: 1200, height: 900, formats: ['svg'] } }) }),
  });
  const perRow = rows.map((r, i) => check(r, i, { srcIndex: i }));
  // Three clean rows, three empty note lists - the run summary says "0 with notes".
  assert.deepEqual(perRow, [[], [], []]);
  const fileSize = runFindings.filter(f => f.id === 'refuse.output-file-size');
  assert.equal(fileSize.length, 1, 'one platform fact, stated once, not once per row');
  assert.equal(fileSize[0]!.rowIndex, undefined, 'a run-level finding names no row');
});

test('a dropped row’s findings survive as an identity-keyed channel', async () => {
  const rows: BatchRow[] = [
    { uid: 'r1', toolId: '', values: {} },
    { uid: 'r2', toolId: 'demo', values: { title: 'x' }, format: 'png' },
  ];
  const { check } = await createBatchRowCheck(rows, {}, {}, {
    getTool: async () => ({ manifest: manifestOf() }),
  });
  const plan = await planBatch<Finding>(rows, {
    check, getTool: async (id: string) => { if (!id) throw new Error('no tool'); return { manifest: manifestOf() }; },
  });
  const dropped = skippedFindings(plan);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0]!.uid, 'r1');
  assert.equal(dropped[0]!.srcIndex, 0, 'the source position rides inside the finding itself');
  assert.equal(dropped[0]!.items[0]!.id, 'collect.row-not-rendered');
});
