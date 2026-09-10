// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSources, createCompareAPI } from '../engine/src/compare.ts';
import type { ComparisonSource, ComparisonOptions, ComparisonRequest } from '@lolly-tools/core/host-v1';
const source = (value: unknown, kind: 'text' | 'structure' = 'structure'): ComparisonSource => ({ identity: { id: 'fixture', kind: 'state', label: 'Fixture' }, content: kind === 'text' ? { kind, text: String(value) } : { kind, value } });
const compare = (a: unknown, b: unknown, options: ComparisonOptions = {}, kind: 'text' | 'structure' = 'structure') => compareSources({ version: 1, before: source(a, kind), after: source(b, kind), options });

test('text fixtures distinguish added, removed and replaced runs with source lines', () => {
  const insert = compare('one\ntwo\n', 'one\nnew\ntwo\n', {}, 'text');
  assert.equal(insert.summary.added, 1); assert.equal(insert.changes[0]?.after?.line, 2);
  assert.equal(compare('one\nnew\ntwo\n', 'one\ntwo\n', {}, 'text').summary.removed, 1);
  const edit = compare('one\ntwo\n', 'one\nthree\n', {}, 'text');
  assert.equal(edit.summary.changed, 1); assert.equal(edit.changes[0]?.beforeValue, 'two\n');
  assert.equal(compare('', '', {}, 'text').equality, 'equivalent-content');
});
test('word detail and whitespace/case options are explicit and preserve original locations', () => {
  const word = compare('keep old word', 'keep new word', { granularity: 'word' }, 'text');
  assert.equal(word.changes[0]?.beforeValue, 'old'); assert.equal(word.changes[0]?.before?.offset, 5);
  assert.equal(compare(' A  B\r\n', 'a b\n', {}, 'text').equality, 'different');
  assert.equal(compare(' A  B\r\n', 'a b\n', { whitespace: 'ignore', ignoreCase: true }, 'text').equality, 'equivalent-content');
});
test('structure compares keys independently of order and arrays by order', () => {
  assert.equal(compare({ a: 1, b: 2 }, { b: 2, a: 1 }).equality, 'equivalent-content');
  const result = compare({ keep: 1, remove: 2, edit: 'old' }, { keep: 1, add: 3, edit: 'new' });
  assert.deepEqual(result.summary, { added: 1, removed: 1, changed: 1, moved: 0, total: 3 });
  assert.equal(compare([1, 2], [2, 1]).summary.changed, 2);
  assert.equal(compare({ 'a.b': 1 }, { 'a.b': 2 }).changes[0]?.before?.path[0], 'a.b');
  assert.match(compare({}, { added: { nested: 'visible value' } }).changes[0]?.afterValue ?? '', /nested.*visible value/);
});
test('stable IDs identify movement while duplicate keys explicitly fall back to position', () => {
  const result = compare([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], [{ id: 'b', text: 'B' }, { id: 'a', text: 'A!' }], { arrayAlignment: 'id' });
  assert.equal(result.summary.moved, 1); assert.equal(result.summary.changed, 1);
  const inserted = compare([{ id: 'a' }, { id: 'b' }], [{ id: 'new' }, { id: 'a' }, { id: 'b' }], { arrayAlignment: 'id' });
  assert.equal(inserted.summary.added, 1); assert.equal(inserted.summary.moved, 0);
  const ambiguous = compare([{ id: 'a' }, { id: 'a' }], [{ id: 'a' }], { arrayAlignment: 'id' });
  assert.match(ambiguous.limitations.join(), /duplicate IDs/); assert.equal(ambiguous.summary.removed, 1);
});
test('byte equality, interpreted equivalence and unavailable appearance remain distinct', () => {
  const before = { ...source({ a: 1 }), bytes: new TextEncoder().encode('{"a":1}') };
  const after = { ...source({ a: 1 }), bytes: new TextEncoder().encode('{ "a": 1 }') };
  const result = compareSources({ version: 1, before, after });
  assert.equal(result.byteEquality, 'different'); assert.equal(result.equality, 'equivalent-content'); assert.equal(result.appearance, 'not-compared');
  assert.equal(compareSources({ version: 1, before, after: before }).equality, 'identical-bytes');
});
test('bounded work, values and result counts never imply unchecked equality', () => {
  const work = compare('a\n'.repeat(2000), 'b\n'.repeat(2000), {}, 'text');
  assert.equal(work.completeness, 'partial'); assert.equal(work.equality, 'undetermined');
  const output = compare(Array(1000).fill(1), Array(1000).fill(2), { maxChanges: 4 });
  assert.equal(output.changes.length, 4); assert.equal(output.summary.total, 1000); assert.equal(output.detailsTruncated, true);
  const large = compare('a'.repeat(3000), 'b'.repeat(3000), {}, 'text');
  assert.equal(large.changes[0]?.beforeValue?.length, 2000); assert.equal(large.changes[0]?.valueTruncated, true);
  assert.equal(compare('a'.repeat(2 * 1024 * 1024 + 1), '', {}, 'text').equality, 'undetermined');
  assert.equal(compare(Array(10), [], {}).equality, 'undetermined');
});
test('incomplete sources, unsupported objects and cycles cannot prove equality', () => {
  const unavailable: ComparisonSource = { ...source({}), fidelity: { level: 'unavailable', limitations: ['Saved bytes unavailable.'] } };
  assert.equal(compareSources({ version: 1, before: unavailable, after: source({}) }).equality, 'undetermined');
  assert.equal(compare(new Date(0), new Date(0)).equality, 'undetermined');
  const a: Record<string, unknown> = {}; a.self = a;
  const b: Record<string, unknown> = {}; b.self = b;
  assert.equal(compare(a, b).equality, 'undetermined');
});
test('host capability returns the same pure result without mutating sources; abort rejects', async () => {
  const request: ComparisonRequest = { version: 1, before: source({ value: 'before' }), after: source({ value: 'after' }) };
  const copy = structuredClone(request);
  assert.deepEqual(await createCompareAPI().run(request), compareSources(request)); assert.deepEqual(request, copy);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createCompareAPI().run(request, { signal: controller.signal }), { name: 'AbortError' });
});
