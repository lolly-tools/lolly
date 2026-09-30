// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenCompatibility } from '../engine/src/token-compatibility.ts';

test('known gaps are visible while aliases, inherited types and unknown extensions stay intact', () => {
  const doc = { base: { $type: 'color', ink: { $value: '#123456' } }, copy: { $extends: '{base}' }, pointer: { $type: 'color', $ref: '#/base/ink/$value' }, alias: { $type: 'color', $value: '{base.ink}' }, missing: { $value: '{lost}' }, a: { $value: '{b}' }, b: { $value: '{a}' }, shadow: { $type: 'shadow', $value: { color: '{base.ink}' } }, $extensions: { vendor: { $ref: 'opaque', data: 1 } } };
  const before = structuredClone(doc);
  const report = tokenCompatibility(doc);
  assert.deepEqual(doc, before);
  assert.deepEqual(report.extensionNamespaces, ['vendor']);
  assert.ok(report.diagnostics.some(d => d.code === 'json-pointer' && d.path === '/pointer/$ref'));
  assert.ok(report.diagnostics.some(d => d.code === 'group-inheritance'));
  assert.ok(report.diagnostics.some(d => d.path === 'shadow'));
  assert.ok(!report.diagnostics.some(d => d.path === 'alias' || d.path.includes('opaque')));
  assert.equal(report.selections[0]?.unresolved, 4);
});
test('Day and Night are checked through the resolver without renaming', () => {
  const doc = { day: { ink: { $value: '#fff', $type: 'color' } }, night: { ink: { $value: '{absent}', $type: 'color' } }, $themes: [{ id: 'day-id', name: 'Day', group: 'Appearance', selectedTokenSets: { day: 'enabled' } }, { id: 'night-id', name: 'Night', group: 'Appearance', selectedTokenSets: { night: 'enabled' } }], $metadata: { tokenSetOrder: ['day', 'night'] } };
  const report = tokenCompatibility(doc);
  assert.deepEqual(report.modes.map(m => m.name), ['Day', 'Night']);
  assert.equal(report.selections.find(s => s.mode === 'night-id')?.unresolved, 1);
  assert.equal(report.selections[0]?.unresolved, 0);
});
test('bounded scans do not label unchecked documents as compatible', () => {
  const doc: Record<string, unknown> = {};
  doc.cycle = doc;
  assert.equal(tokenCompatibility(doc).truncated, true);
  assert.equal(tokenCompatibility(doc).selections.length, 0);
  assert.ok(tokenCompatibility(doc).diagnostics.some(d => d.code === 'limit'));
});
