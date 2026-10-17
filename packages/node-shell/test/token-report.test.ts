// SPDX-License-Identifier: MPL-2.0
/**
 * The shared token report behind the TUI inspector and `lolly_inspect_tokens`
 * (plan 286 M5): the normalized selection and preview flag, a revision that ignores
 * key order, filtered and paged lists, and a breadth-first trace that stops at its
 * depth and node limits and marks references with no active definition.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { inspectTokenDocument } from '@lolly/engine';
import {
  TOKEN_REPORT_LIMITS,
  TokenReportError,
  listTokenRows,
  storedTokenChoices,
  tokenReport,
  tokenRevision,
  traceToken,
} from '../src/token-report.ts';

const beacon = (): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL('../../../shells/web/public/examples/beacon.tokens.json', import.meta.url), 'utf8'));
const origin = { kind: 'supplied' as const };

/** A single-set chain t0 -> t1 -> ... -> t(n-1), each aliasing the next. */
function chain(n: number): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) doc[`t${i}`] = { $type: 'color', $value: i === n - 1 ? '#000000' : `{t${i + 1}}` };
  return doc;
}

test('the context gives one choice per group, the defaults, the set order and whether the choices are a preview', () => {
  const doc = beacon();
  const stored = tokenReport(doc, { origin });
  assert.deepEqual(stored.context.selection.choices, { appearance: 'day', density: 'compact' });
  assert.deepEqual(stored.context.stored, { appearance: 'day', density: 'compact' });
  assert.deepEqual(stored.context.selection.sets, ['foundation', 'day', 'compact']);
  assert.equal(stored.context.preview, false);
  assert.deepEqual(stored.context.requested, {});
  assert.deepEqual(stored.context.selection.groups.map((g) => [g.id, g.options.map((o) => o.id)]), [['appearance', ['day', 'night']], ['density', ['compact', 'roomy']]]);

  const night = tokenReport(doc, { origin, selection: { appearance: 'night', density: 'roomy' } });
  assert.deepEqual(night.context.selection.choices, { appearance: 'night', density: 'roomy' });
  assert.deepEqual(night.context.selection.sets, ['foundation', 'night', 'roomy']);
  assert.equal(night.context.preview, true);
  assert.deepEqual(night.context.requested, { selection: { appearance: 'night', density: 'roomy' } });
  assert.equal(night.scope, 'token-document');
  assert.equal(night.format, 'lolly-token-report');
});

test('an unknown choice is a diagnostic and the group keeps its default', () => {
  const report = tokenReport(beacon(), { origin, selection: { appearance: 'dusk', density: 'compact' } });
  assert.equal(report.context.selection.choices.appearance, 'day');
  assert.ok(report.context.selection.defaults.includes('appearance'));
  assert.deepEqual(report.diagnostics, [{ code: 'selection', path: '', message: 'Unknown choice dusk in appearance.' }]);
  assert.equal(report.counts.diagnostics, 1);
});

test('the revision is the canonical digest, so key order never changes it', () => {
  const doc = beacon();
  const reordered = Object.fromEntries(Object.entries(doc).reverse());
  assert.match(tokenRevision(doc), /^sha256:[0-9a-f]{64}$/);
  assert.equal(tokenRevision(reordered), tokenRevision(doc));
  const edited = beacon();
  (((edited.foundation as Record<string, unknown>).identity as Record<string, unknown>).Beacon as Record<string, unknown>).$value = '#000000';
  assert.notEqual(tokenRevision(edited), tokenRevision(doc));
  assert.deepEqual(storedTokenChoices(reordered), storedTokenChoices(doc));
});

test('the list filters by text, type, set and issues, and pages within its bounds', () => {
  const inspection = inspectTokenDocument(beacon());
  const all = listTokenRows(inspection);
  assert.equal(all.total, 10);
  assert.equal(all.limit, TOKEN_REPORT_LIMITS.listDefault);
  assert.deepEqual(listTokenRows(inspection, { query: 'SEMANTIC' }).rows.map((r) => r.path), ['color.semantic.primary', 'color.semantic.surface', 'color.semantic.foreground']);
  assert.deepEqual(listTokenRows(inspection, { type: 'dimension' }).rows.map((r) => r.path), ['space.exampleGap', 'stroke.exampleWidth']);
  assert.equal(listTokenRows(inspection, { set: 'night' }).total, 4, 'night defines three colours and a border');
  assert.equal(listTokenRows(inspection, { issuesOnly: true }).total, 0);
  const page = listTokenRows(inspection, { offset: 2, limit: 3 });
  assert.deepEqual(page.rows.map((r) => r.path), ['identity.Paper', 'font.brand', 'color.semantic.primary']);
  assert.equal(page.total, 10);
  assert.equal(listTokenRows(inspection, { limit: 10_000 }).limit, TOKEN_REPORT_LIMITS.listMax);
  const primary = all.rows.find((r) => r.path === 'color.semantic.primary')!;
  assert.deepEqual(primary, { path: 'color.semantic.primary', type: 'color', set: 'day', active: true, resolved: '#7c3aed', issues: 0 });
});

test('a trace follows references towards the primitives and dependents away from them, under the effective choices', () => {
  const doc = beacon();
  const day = tokenReport(doc, { origin, token: 'border.exampleOutline' }).trace!;
  assert.equal(day.source?.set, 'day');
  assert.deepEqual(day.candidates.map((c) => [c.set, c.active]), [['night', false], ['day', true]]);
  assert.deepEqual(day.references.map((s) => [s.path, s.depth, s.via]), [
    ['color.semantic.primary', 1, 'border.exampleOutline'],
    ['stroke.exampleWidth', 1, 'border.exampleOutline'],
    ['identity.Beacon', 2, 'color.semantic.primary'],
  ]);
  assert.equal(day.references[2]!.resolved, '#7c3aed');
  assert.deepEqual(day.dependents, []);
  assert.equal(day.truncated, false);

  const beaconDay = tokenReport(doc, { origin, token: 'identity.Beacon' }).trace!;
  assert.deepEqual(beaconDay.dependents.map((s) => [s.path, s.depth, s.via]), [
    ['color.semantic.primary', 1, 'identity.Beacon'],
    ['border.exampleOutline', 2, 'color.semantic.primary'],
  ]);
  // Night's primary is a literal, so nothing reads the Beacon colour under night.
  const beaconNight = tokenReport(doc, { origin, token: 'identity.Beacon', selection: { appearance: 'night', density: 'compact' } }).trace!;
  assert.deepEqual(beaconNight.dependents, []);
});

test('a trace stops at its depth and marks a reference with no active definition', () => {
  const inspection = inspectTokenDocument(chain(6));
  const short = traceToken(inspection, 't0', 2)!;
  assert.deepEqual(short.references.map((s) => s.path), ['t1', 't2']);
  assert.equal(short.depth, 2);
  assert.equal(short.truncated, true);
  const full = traceToken(inspection, 't0')!;
  assert.deepEqual(full.references.map((s) => s.depth), [1, 2, 3, 4, 5]);
  assert.equal(full.truncated, false);
  assert.equal(traceToken(inspection, 't0', 999)!.depth, TOKEN_REPORT_LIMITS.depthMax);

  const broken = traceToken(inspectTokenDocument({ a: { $type: 'color', $value: '{gone}' } }), 'a')!;
  assert.deepEqual(broken.references, [{ path: 'gone', depth: 1, via: 'a', type: null, missing: true }]);
  assert.ok(broken.diagnostics.some((d) => d.code === 'missing'));
});

test('a trace lists each token once in a cycle and stops at the node limit', () => {
  const cyclic = traceToken(inspectTokenDocument({ a: { $type: 'color', $value: '{b}' }, b: { $type: 'color', $value: '{a}' } }), 'a')!;
  assert.deepEqual(cyclic.references.map((s) => s.path), ['b']);
  assert.deepEqual(cyclic.dependents.map((s) => s.path), ['b']);
  assert.ok(cyclic.diagnostics.some((d) => d.code === 'cycle'));

  const wide: Record<string, unknown> = { root: { $type: 'color', $value: '#000000' } };
  for (let i = 0; i < TOKEN_REPORT_LIMITS.traceNodes + 5; i++) wide[`leaf${i}`] = { $type: 'color', $value: '{root}' };
  const fan = traceToken(inspectTokenDocument(wide), 'root')!;
  assert.equal(fan.dependents.length, TOKEN_REPORT_LIMITS.traceNodes);
  assert.equal(fan.truncated, true);
});

test('a token the document lacks is a coded error with similar paths', () => {
  assert.throws(() => tokenReport(beacon(), { origin, token: 'primary' }), (err: unknown) => {
    assert.ok(err instanceof TokenReportError);
    assert.equal(err.code, 'token.unknown');
    assert.match(err.message, /Similar paths: color\.semantic\.primary\./);
    return true;
  });
});

test('issue lists are bounded and the report says when it stopped early', () => {
  const doc: Record<string, unknown> = {};
  for (let i = 0; i < TOKEN_REPORT_LIMITS.issues + 10; i++) doc[`m${i}`] = { $type: 'color', $value: `{missing${i}}` };
  const report = tokenReport(doc, { origin });
  assert.equal(report.issues.length, TOKEN_REPORT_LIMITS.issues);
  assert.equal(report.counts.withIssues, TOKEN_REPORT_LIMITS.issues + 10);
  assert.equal(report.truncated, true);
  assert.equal(listTokenRows(inspectTokenDocument(doc), { issuesOnly: true }).total, TOKEN_REPORT_LIMITS.issues + 10);
});
