// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readComparisonYaml } from '../engine/src/compare-yaml.ts';
import { compareSources, createCompareAPI } from '../engine/src/compare.ts';
import type { ComparisonSource } from '@lolly-tools/core/host-v1';

function read(text: string): unknown {
  const result = readComparisonYaml(text);
  if (!result.ok) throw new Error(result.limitation);
  return result.value;
}
function refused(text: string, reason?: RegExp): string {
  const result = readComparisonYaml(text);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Expected a YAML refusal.');
  assert.match(result.limitation, /Choose Text mode\.$/);
  if (reason) assert.match(result.limitation, reason);
  return result.limitation;
}
const ordinary = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const yaml = (text: string, bytes?: Uint8Array): ComparisonSource => ({ identity: { id: 'yaml', kind: 'file', label: 'YAML' }, content: { kind: 'yaml', text }, ...(bytes ? { bytes } : {}) });
const structure = (value: unknown): ComparisonSource => ({ identity: { id: 'structure', kind: 'state', label: 'Data' }, content: { kind: 'structure', value } });

test('ordinary block and flow YAML uses fixed core scalar semantics', () => {
  const value = read('name: example\nvalues: [yes, on, false, TRUE, null, ~, 0x10, 0o10, +012, 1.5, 1e2]\ndate: 2026-10-12\nquoted: "true"\nmissing:\n');
  assert.deepEqual(ordinary(value), { name: 'example', values: ['yes', 'on', false, true, null, null, 16, 8, 12, 1.5, 100], date: '2026-10-12', quoted: 'true', missing: null });
  for (const [text, expected] of [['null', null], ['false', false], ['1.25', 1.25], ['""', ''], ['-0x10', '-0x10']] as const) assert.equal(read(text), expected);
});

test('multiline, quoted markers, Unicode and document-end markers remain ordinary values', () => {
  const value = read('---\r\ntext: |-\r\n  first\r\n  --- !tag &anchor *alias\r\nfolded: >-\r\n  one\r\n  two\r\nquoted: "!custom &anchor *alias"\r\nemoji: "😀"\r\n...\r\n');
  assert.deepEqual(ordinary(value), { text: 'first\n--- !tag &anchor *alias', folded: 'one two', quoted: '!custom &anchor *alias', emoji: '😀' });
  assert.equal(read('\ufeff"BOM text"'), 'BOM text');
});

test('maps retain decoded prototype keys as data without changing prototypes', () => {
  const value = read('__proto__: { polluted: true }\nconstructor: x\nprototype: y\n') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(value), null);
  assert.equal(Object.getPrototypeOf(Object.getOwnPropertyDescriptor(value, '__proto__')!.value), null);
  assert.deepEqual(ordinary(value), { ['__proto__']: { polluted: true }, constructor: 'x', prototype: 'y' });
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});

test('decoded duplicate keys and non-string keys cannot coalesce', () => {
  for (const text of ['a: 1\na: 2', 'a: 1\n"\\u0061": 2', '"a": 1\n\'a\': 2', '{1: x}', '{true: x}', '{null: x}', '? [a, b]\n: x', ': x']) refused(text, /unique string keys/);
});

test('anchors, aliases, tags, directives and merge keys refuse without evaluation', () => {
  for (const text of ['a: &SECRET_ANCHOR x', '[*SECRET_ALIAS]', '&x [*x]', 'a: &x { n: 1 }\nb: *x']) refused(text, /anchors and aliases/);
  for (const text of ['!SECRET_TAG value', '!!str value', '%YAML 1.1\n---\nyes', '%TAG !x! tag:PRIVATE:\n---\na: x']) refused(text, /tags and directives/);
  for (const text of ['<<: { a: 1 }', '"<<": x', '"\\u003c\\u003c": x']) refused(text, /merge keys/);
});

test('empty or multiple documents and malformed text have fixed private refusals', () => {
  for (const text of ['', '\n# only a comment\n', '---\n', 'a: 1\n---\nb: 2', '---\nnull\n---\nnull']) refused(text, /one nonempty document/);
  for (const text of ['SECRET_FIELD: { SECRET_TOKEN', '[1, 2', 'a: "\\qSECRET"', 'a:\tSECRET\nb: [']) assert.doesNotMatch(refused(text), /SECRET/);
});

test('numeric limits prevent integer rounding, non-finite values and nonzero underflow', () => {
  assert.equal(read('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.equal(read('-9007199254740991'), Number.MIN_SAFE_INTEGER);
  assert.equal(read('5e-324'), Number.MIN_VALUE);
  for (const text of ['9007199254740992', '-9007199254740992', '9007199254740993', '.inf', '-.Inf', '.NaN', '1e999', '1e-999', '-1e-999', '1.0e-999', '1e16']) refused(text, /finite numbers and safe integers/);
  assert.equal(read('0e-999'), 0);
  assert.equal(read('0'.repeat(128)), 0);
  refused('0'.repeat(129), /reading limits/);
});

test('UTF-8 input and scalar limits apply before construction', () => {
  const prefix = 'x: 1\n#', bytes = 2 * 1024 * 1024;
  const ascii = prefix + 'p'.repeat(bytes - prefix.length);
  assert.equal((read(ascii) as Record<string, unknown>).x, 1);
  refused(ascii + 'p', /reading limits/);
  const available = bytes - prefix.length;
  const unicode = prefix + '€'.repeat(Math.floor(available / 3)) + 'p'.repeat(available % 3);
  assert.equal(Buffer.byteLength(unicode), bytes);
  assert.equal((read(unicode) as Record<string, unknown>).x, 1);
  refused(unicode + '€', /reading limits/);
  assert.equal(read('x'.repeat(64 * 1024)), 'x'.repeat(64 * 1024));
  refused('x'.repeat(64 * 1024 + 1), /reading limits/);
  for (const text of ['"\ud800"', '"\udc00"', '"\\uD800"']) refused(text, /malformed or unsupported/);
});

test('deep flow, compact block and large flat collections are bounded before composition', () => {
  assert.ok(Array.isArray(read('['.repeat(64) + '0' + ']'.repeat(64))));
  refused('['.repeat(65) + '0' + ']'.repeat(65), /reading limits/);
  refused('['.repeat(5000) + '0' + ']'.repeat(5000), /reading limits/);
  refused('- '.repeat(5000) + 'x', /reading limits/);
  assert.equal((read(`[${Array.from({ length: 19_999 }, () => '0').join(',')}]`) as unknown[]).length, 19_999);
  refused(`[${Array.from({ length: 20_000 }, () => '0').join(',')}]`, /reading limits/);
  refused(Array.from({ length: 10_000 }, (_, i) => `key${i}: x`).join('\n'), /reading limits/);
  refused('\n'.repeat(100_001) + 'x', /reading limits/);
});

test('raw YAML normalization selects structure and preserves successful coverage', () => {
  const before = yaml('a: 1\nb: [x, y]\n'), after = yaml('{b: [x, y], a: 1} # different formatting\n');
  const result = compareSources({ version: 1, before, after });
  assert.equal(result.mode, 'structure'); assert.equal(result.equality, 'equivalent-content');
  assert.equal(result.completeness, 'complete'); assert.equal(result.summary.total, 0);
  assert.ok(result.limitations.some(text => /Comments, key order, quoting and formatting/.test(text)));
  const supplied = structure({ a: 1, b: ['x', 'y'] });
  assert.equal(compareSources({ version: 1, before, after: supplied }).mode, 'structure');
  assert.equal(compareSources({ version: 1, before: supplied, after }).equality, 'equivalent-content');
});

test('raw YAML changes reuse ordered arrays and explicit stable-ID matching', () => {
  const before = yaml('items: [{id: a, value: 1}, {id: b, value: 2}]'), after = yaml('items: [{id: b, value: 3}, {id: a, value: 1}]');
  const result = compareSources({ version: 1, before, after, options: { mode: 'structure', arrayAlignment: 'id' } });
  assert.equal(result.equality, 'different'); assert.equal(result.summary.moved, 1); assert.equal(result.summary.changed, 1);
  assert.ok(result.changes.some(change => change.after?.path.join('.') === 'items.0.value'));
});

test('refused YAML returns unavailable, undetermined and zero fake changes even for equal bytes', () => {
  const text = 'SECRET_FIELD: !SECRET_TAG SECRET_VALUE', bytes = new TextEncoder().encode(text);
  const before = yaml(text, bytes), after = structure({ actual: 'different' });
  for (const other of [after, yaml(text, bytes)]) {
    const result = compareSources({ version: 1, before, after: other });
    assert.equal(result.mode, 'structure'); assert.equal(result.equality, 'undetermined'); assert.equal(result.completeness, 'partial');
    assert.deepEqual(result.summary, { added: 0, removed: 0, changed: 0, moved: 0, total: 0 }); assert.deepEqual(result.changes, []);
    assert.ok(result.limitations.some(text => /tags and directives/.test(text)));
    assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  }
  assert.equal(compareSources({ version: 1, before, after: before }).byteEquality, 'equal');
});

test('normalization preserves identity, bytes, supplied fidelity and the original request', async () => {
  const bytes = new TextEncoder().encode('a: 1'), after = yaml('a: 2');
  const before: ComparisonSource = { ...yaml('a: 1', bytes), fidelity: { level: 'partial', limitations: ['Earlier reading is partial.'] } };
  const request = { version: 1 as const, before, after, options: { mode: 'structure' as const } }, saved = structuredClone(request);
  const result = await createCompareAPI().run(request);
  assert.deepEqual(request, saved); assert.deepEqual(result.before, before.identity);
  assert.equal(result.completeness, 'partial'); assert.ok(result.limitations.includes('Earlier reading is partial.'));
  assert.equal(before.bytes, bytes);
});

test('selected text mode never silently reads YAML or runs a fallback', () => {
  const before = yaml('!SECRET x'), after = yaml('!SECRET y');
  const result = compareSources({ version: 1, before, after, options: { mode: 'text' } });
  assert.equal(result.equality, 'undetermined'); assert.equal(result.mode, 'text'); assert.equal(result.summary.total, 0);
  assert.deepEqual(result.limitations, ['The selected mode does not match both sources.']);
  const rawBefore: ComparisonSource = { ...before, content: { kind: 'text', text: before.content.kind === 'yaml' ? before.content.text : '' } };
  const rawAfter: ComparisonSource = { ...after, content: { kind: 'text', text: after.content.kind === 'yaml' ? after.content.text : '' } };
  assert.equal(compareSources({ version: 1, before: rawBefore, after: rawAfter, options: { mode: 'text' } }).equality, 'different');
});

test('pre-aborted reading and comparison reject rather than produce refusals', async () => {
  const controller = new AbortController(); controller.abort();
  assert.throws(() => readComparisonYaml('a: 1', controller.signal), { name: 'AbortError' });
  const request = { version: 1 as const, before: yaml('a: 1'), after: yaml('a: 2') };
  assert.throws(() => compareSources(request, controller.signal), { name: 'AbortError' });
  await assert.rejects(createCompareAPI().run(request, { signal: controller.signal }), { name: 'AbortError' });
});
