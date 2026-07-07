// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the CSV/JSON → blocks importer (engine/src/data-import.js).
 *
 * Pure — the shell reads a file to text and hands it here — so these cover the
 * parsing, column→field mapping, coercion and guards end to end.
 *
 * Run with: node --test tests/data-import.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDataRows, DEFAULT_ROW_LIMIT } from '../engine/src/data-import.ts';

const F = [{ id: 'label', label: 'Label' }, { id: 'value', label: 'Value' }, { id: 'color', label: 'Color', type: 'color' }];

test('CSV: maps columns to fields by header (field id)', () => {
  const { rows, truncated } = parseDataRows('label,value\nLinux,67\nCloud,54', { fields: F });
  assert.equal(truncated, false);
  assert.deepEqual(rows, [
    { label: 'Linux', value: '67', color: '' },
    { label: 'Cloud', value: '54', color: '' },
  ]);
});

test('CSV: header matches a field label case-insensitively', () => {
  const { rows } = parseDataRows('LABEL,Value,COLOR\nA,1,#fff', { fields: F });
  assert.deepEqual(rows[0], { label: 'A', value: '1', color: '#fff' });
});

test('CSV: RFC-4180 quoting — commas, embedded newline, escaped quotes', () => {
  const csv = 'label,value\r\n"Smith, Jr.",10\r\n"line1\nline2",20\r\n"say ""hi""",30';
  const { rows } = parseDataRows(csv, { fields: F });
  assert.equal(rows[0]!.label, 'Smith, Jr.');
  assert.equal(rows[1]!.label, 'line1\nline2');
  assert.equal(rows[2]!.label, 'say "hi"');
  assert.deepEqual(rows.map(r => r.value), ['10', '20', '30']);
});

test('CSV: explicit columns map overrides header matching', () => {
  const { rows } = parseDataRows('name,amount\nA,5\nB,6', {
    fields: F, columns: { label: 'name', value: 'amount' },
  });
  assert.deepEqual(rows.map(r => ({ label: r.label, value: r.value })), [
    { label: 'A', value: '5' }, { label: 'B', value: '6' },
  ]);
});

test('CSV: unmatched fields fill empty, extra columns are ignored', () => {
  const { rows } = parseDataRows('label,value,extra\nA,1,ignored', { fields: F });
  assert.deepEqual(rows[0], { label: 'A', value: '1', color: '' });
});

test('CSV: skips fully-blank rows and trailing newline', () => {
  const { rows } = parseDataRows('label,value\nA,1\n\n,\nB,2\n', { fields: F });
  assert.deepEqual(rows.map(r => r.label), ['A', 'B']);
});

test('JSON: array of objects maps by key (case-insensitive)', () => {
  const json = JSON.stringify([{ Label: 'A', Value: 1, Color: '#111' }, { Label: 'B', Value: 2 }]);
  const { rows } = parseDataRows(json, { fields: F });
  assert.deepEqual(rows, [
    { label: 'A', value: '1', color: '#111' },
    { label: 'B', value: '2', color: '' },
  ]);
});

test('JSON: bare array of arrays maps positionally in field order', () => {
  const json = JSON.stringify([['A', 1, '#111'], ['B', 2, '#222']]);
  const { rows } = parseDataRows(json, { fields: F });
  assert.deepEqual(rows.map(r => r.label), ['A', 'B']);
  assert.deepEqual(rows.map(r => r.value), ['1', '2']);
});

test('JSON: accepts a { data: [...] } wrapper', () => {
  const json = JSON.stringify({ data: [{ label: 'A', value: 9 }] });
  const { rows } = parseDataRows(json, { fields: F });
  assert.equal(rows[0]!.label, 'A');
  assert.equal(rows[0]!.value, '9');
});

test('JSON: a null element in the array is skipped, not fatal', () => {
  // A common shape when an API returns null for a deleted/missing list entry.
  const json = JSON.stringify([{ label: 'A', value: 1 }, null, { label: 'B', value: 2 }]);
  const { rows } = parseDataRows(json, { fields: F });
  assert.deepEqual(rows.map(r => r.label), ['A', 'B']);
});

test('JSON: a null element in an array-of-arrays is skipped too', () => {
  const json = JSON.stringify([['A', 1], null, ['B', 2]]);
  const { rows } = parseDataRows(json, { fields: F });
  assert.deepEqual(rows.map(r => r.label), ['A', 'B']);
});

test('format auto-detects (JSON vs CSV) when not given', () => {
  const j = parseDataRows('[{"label":"A","value":1}]', { fields: F });
  assert.equal(j.rows[0]!.label, 'A');
  const c = parseDataRows('label,value\nA,1', { fields: F });
  assert.equal(c.rows[0]!.label, 'A');
});

test('boolean field coerces truthy/falsy tokens', () => {
  const fields = [{ id: 'on', type: 'boolean' }];
  const { rows } = parseDataRows('on\nyes\nno\n1\nfalse', { fields });
  assert.deepEqual(rows.map(r => r.on), ['true', 'false', 'true', 'false']);
});

test('row limit caps output and reports truncation', () => {
  const lines = ['label,value'];
  for (let i = 0; i < 5; i++) lines.push(`r${i},${i}`);
  const { rows, truncated } = parseDataRows(lines.join('\n'), { fields: F, limit: 3 });
  assert.equal(rows.length, 3);
  assert.equal(truncated, true);
});

test('strips a leading BOM before parsing', () => {
  const { rows } = parseDataRows('﻿label,value\nA,1', { fields: F });
  assert.equal(rows[0]!.label, 'A');
});

test('throws a clear message on empty input', () => {
  assert.throws(() => parseDataRows('   ', { fields: F }), /empty/i);
});

test('throws when no column matches any field (nothing usable)', () => {
  assert.throws(() => parseDataRows('foo,bar\n1,2', { fields: F }), /No usable rows/);
});

test('throws when the input has no fields to import into', () => {
  assert.throws(() => parseDataRows('a,b\n1,2', { fields: [] }), /no fields/i);
});

test('invalid JSON produces a friendly error, not a raw SyntaxError', () => {
  assert.throws(() => parseDataRows('[{bad json', { fields: F, format: 'json' }), /isn’t valid JSON|valid JSON/);
});

test('DEFAULT_ROW_LIMIT is exported and sane', () => {
  assert.equal(typeof DEFAULT_ROW_LIMIT, 'number');
  assert.ok(DEFAULT_ROW_LIMIT >= 100);
});
