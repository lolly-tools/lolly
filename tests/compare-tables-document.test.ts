// SPDX-License-Identifier: MPL-2.0
/** Golden content matching: insertions, moves, ambiguity and partial equality. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComparisonDocumentUnit, ComparisonOptions, ComparisonSource, ComparisonTable } from '../packages/core/src/host-v1/compare.ts';
import { compareSources, createCompareAPI } from '../engine/src/compare.ts';
const source = (content: ComparisonSource['content'], label: string): ComparisonSource => ({ identity: { id: label, label, kind: 'file' }, content });
function tables(before: ComparisonTable[], after: ComparisonTable[], options: ComparisonOptions = {}) {
  return compareSources({ version: 1, before: source({ kind: 'table', tables: before }, 'Before'), after: source({ kind: 'table', tables: after }, 'After'), options });
}
function documents(before: ComparisonDocumentUnit[], after: ComparisonDocumentUnit[], options: ComparisonOptions = {}) {
  return compareSources({ version: 1, before: source({ kind: 'document', units: before }, 'Before'), after: source({ kind: 'document', units: after }, 'After'), options });
}
const sheet = (rows: ComparisonTable['rows'], columns = ['id', 'amount'], name = 'Sales'): ComparisonTable => ({ name, columns, rows });
const units = (...text: string[]): ComparisonDocumentUnit[] => text.map((text, index) => ({ text, location: { page: index + 1 } }));

test('a keyed row insertion changes no later row and retains source row locations', () => {
  const result = tables([sheet([['a', 1], ['b', 2]])], [sheet([['a', 1], ['x', 7], ['b', 2]])], { tableRowKey: 'id' });
  assert.equal(result.mode, 'table'); assert.equal(result.alignment, 'table-key');
  assert.deepEqual(result.summary, { added: 1, removed: 0, changed: 0, moved: 0, total: 1 });
  assert.equal(result.changes[0]!.after!.table, 'Sales'); assert.equal(result.changes[0]!.after!.row, 2);
});
test('keyed changes locate cells after independent row and column moves', () => {
  const result = tables([sheet([['a', 1], ['b', 2]])], [sheet([[3, 'b'], [1, 'a']], ['amount', 'id'])], { tableRowKey: 'id' });
  assert.equal(result.summary.changed, 1); assert.equal(result.summary.moved, 2);
  const cell = result.changes.find(change => change.kind === 'changed')!;
  assert.equal(cell.before!.row, 2); assert.equal(cell.after!.row, 1);
  assert.equal(cell.before!.column, 'amount'); assert.equal(cell.after!.column, 'amount');
  assert.equal(cell.beforeValue, '2'); assert.equal(cell.afterValue, '3');
});
test('unique sheet names align inserted and moved sheets without cell cascades', () => {
  const a = sheet([['a', 1]]), b = sheet([['b', 2]], undefined, 'Costs'), extra = sheet([], undefined, 'New');
  const result = tables([a, b], [b, extra, a]);
  assert.equal(result.summary.added, 1); assert.equal(result.summary.moved, 1); assert.equal(result.summary.changed, 0);
});
test('missing, blank and duplicate keys stay positional with an explanation', () => {
  for (const [before, after] of [
    [sheet([['a', 1], ['a', 2]]), sheet([['a', 2], ['a', 1]])],
    [sheet([['', 1]]), sheet([['', 2]])],
    [sheet([['a', 1]], ['wrong', 'amount']), sheet([['a', 2]])],
    [sheet([['a', 1]], ['id', 'id']), sheet([['a', 2]], ['id', 'id'])],
  ]) {
    const result = tables([before!], [after!], { tableRowKey: 'id' });
    assert.equal(result.alignment, 'table-position'); assert.equal(result.equality, 'different');
    assert.ok(result.limitations.some(message => message.includes('ambiguous rows')));
    assert.ok(result.changes.some(change => change.before?.row));
  }
});
test('number and text keys remain distinct and the default row rule is positional', () => {
  const before = sheet([[1, 'number'], ['1', 'text']]), after = sheet([['1', 'text'], [1, 'number']]);
  assert.equal(tables([before], [after], { tableRowKey: 'id' }).summary.moved, 1);
  assert.equal(tables([before], [after]).alignment, 'table-position');
  assert.equal(tables([before], [after]).summary.changed, 4);
});
test('duplicate column and table names retain all positions without invented matching', () => {
  const result = tables([sheet([['a', 1]], ['x', 'x'], 'Same'), sheet([['b', 2]], undefined, 'Same')], [sheet([['a', 3]], ['x', 'x'], 'Same'), sheet([['b', 2]], undefined, 'Same')]);
  assert.equal(result.summary.changed, 1);
  assert.ok(result.limitations.some(message => message.includes('table position')));
  assert.ok(result.limitations.some(message => message.includes('column position')));
});
test('keyed removal, column addition and edited values are distinct changes', () => {
  const result = tables([sheet([['a', 1], ['b', 2]])], [sheet([['a', 4, true]], ['id', 'amount', 'active'])], { tableRowKey: 'id' });
  assert.equal(result.summary.removed, 1); assert.equal(result.summary.changed, 1); assert.equal(result.summary.added, 2);
});
test('table caps, unknown cells and exhausted work never establish equality', () => {
  for (const before of [sheet([['a', 1, 'orphan']]), sheet([], Array(513).fill('column')), sheet([['a', 'x'.repeat(2 * 1024 * 1024 + 1)]])]) {
    const result = tables([before], [before]); assert.equal(result.completeness, 'partial'); assert.equal(result.equality, 'undetermined');
  }
  const work = tables([sheet([['a', 1]])], [sheet([['a', 1]])], { maxWork: 1 });
  assert.equal(work.equality, 'undetermined');
});
test('change excerpts and detail caps retain accurate totals without source mutation', () => {
  const before = [sheet([['a', 'secret-before']])], after = [sheet([['a', 'x'.repeat(2100)]])];
  const snapshot = structuredClone({ before, after });
  const result = tables(before, after, { maxChanges: 1 });
  assert.equal(result.changes[0]!.afterValue!.length, 2000); assert.equal(result.changes[0]!.valueTruncated, true);
  assert.deepEqual({ before, after }, snapshot);
  const limited = tables([sheet([['a', 1], ['b', 2]])], [sheet([['a', 3], ['b', 4]])], { maxChanges: 1 });
  assert.equal(limited.summary.total, 2); assert.equal(limited.changes.length, 1); assert.equal(limited.detailsTruncated, true);
});
test('exact text anchors identify inserted and removed pages without positional cascades', () => {
  const result = documents(units('Alpha', 'Beta'), units('Alpha', 'New', 'Beta'));
  assert.equal(result.alignment, 'document-text'); assert.equal(result.summary.added, 1); assert.equal(result.summary.moved, 0); assert.equal(result.summary.changed, 0);
  assert.equal(result.changes[0]!.after!.page, 2);
  const reverse = documents(units('Alpha', 'New', 'Beta'), units('Alpha', 'Beta'));
  assert.equal(reverse.summary.removed, 1); assert.equal(reverse.changes[0]!.before!.page, 2);
});
test('retained slide IDs locate changed text and distinguish a move', () => {
  const before = [{ id: '256', text: 'Title', location: { slide: 1 } }, { id: '257', text: 'Old value', location: { slide: 2 } }];
  const after = [{ id: '257', text: 'New value', location: { slide: 1 } }, { id: '256', text: 'Title', location: { slide: 2 } }];
  const result = documents(before, after, { documentAlignment: 'id', granularity: 'word' });
  assert.equal(result.alignment, 'document-id'); assert.equal(result.summary.moved, 1); assert.equal(result.summary.changed, 1);
  const changed = result.changes.find(change => change.kind === 'changed')!;
  assert.equal(changed.before!.slide, 2); assert.equal(changed.after!.slide, 1);
  assert.equal(changed.beforeValue, 'Old'); assert.equal(changed.afterValue, 'New');
});
test('text-based moves are explained as content anchors rather than persistent identities', () => {
  const result = documents(units('Alpha', 'Beta'), units('Beta', 'Alpha'));
  assert.equal(result.summary.moved, 1); assert.ok(result.limitations.some(message => message.includes('does not establish a stable')));
});
test('edited unmatched text retains before and after block locations', () => {
  const before = units('Heading', 'Old paragraph', 'Footer').map((unit, i) => ({ ...unit, location: { block: i + 1 } }));
  const after = units('Heading', 'New paragraph', 'Footer').map((unit, i) => ({ ...unit, location: { block: i + 1 } }));
  const result = documents(before, after);
  assert.equal(result.summary.changed, 1); assert.equal(result.changes[0]!.before!.block, 2); assert.equal(result.changes[0]!.after!.block, 2);
  assert.ok(result.limitations.some(message => message.includes('remaining order')));
});
test('duplicate or missing document IDs fall back visibly instead of coalescing units', () => {
  for (const before of [[{ id: 'a', text: 'one' }, { id: 'a', text: 'two' }], [{ text: 'one' }, { text: 'two' }]]) {
    const result = documents(before, [{ id: 'a', text: 'two' }, { id: 'b', text: 'one' }], { documentAlignment: 'id' });
    assert.equal(result.alignment, 'document-position'); assert.equal(result.equality, 'different');
    assert.ok(result.limitations.some(message => message.includes('duplicate unit IDs')));
  }
});
test('repeated and blank page text remain visible and never acquire stable matching', () => {
  const result = documents(units('', 'same', 'same'), units('', 'same', 'changed'));
  assert.equal(result.summary.changed, 1); assert.equal(result.summary.moved, 0);
  assert.ok(result.limitations.some(message => message.includes('repeated unit text')));
});
test('document text respects explicit case and whitespace choices', () => {
  const result = documents(units(' A  B\n'), units('a b'), { ignoreCase: true, whitespace: 'ignore' });
  assert.equal(result.equality, 'equivalent-content'); assert.equal(result.summary.total, 0);
});
test('document caps and incomplete extraction cannot be represented as equality', () => {
  assert.equal(documents(units('x'.repeat(2 * 1024 * 1024 + 1)), units('x'.repeat(2 * 1024 * 1024 + 1))).equality, 'undetermined');
  const before = source({ kind: 'document', units: units('same') }, 'Before');
  const result = compareSources({ version: 1, before: { ...before, fidelity: { level: 'partial', limitations: ['No OCR text was available.'] } }, after: before });
  assert.equal(result.equality, 'undetermined'); assert.equal(result.completeness, 'partial');
  assert.ok(result.limitations.includes('No OCR text was available.'));
});
test('host API and direct engine comparison return equivalent immutable results', async () => {
  const request = { version: 1 as const, before: source({ kind: 'table', tables: [sheet([['a', 1]])] }, 'Before'), after: source({ kind: 'table', tables: [sheet([['a', 2]])] }, 'After'), options: { tableRowKey: 'id' } };
  const snapshot = structuredClone(request);
  assert.deepEqual(await createCompareAPI().run(request), compareSources(request)); assert.deepEqual(request, snapshot);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(createCompareAPI().run(request, { signal: cancelled.signal }), { name: 'AbortError' });
});
