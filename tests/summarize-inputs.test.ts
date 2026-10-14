// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for summarizeInputs (engine/src/inputs.ts) - the compact scalar-input
 * digest embedded in export provenance (the C2PA tools.lolly.export assertion).
 * These pin down WHAT is included (short scalars + full text/longtext), what is
 * deliberately dropped (uploads, groups, profile PII, empties), and the shape
 * guarantees (units appended, non-text values sampled, text kept full up to a cap,
 * entry cap) so an inspected asset shows a rich "made from" without a fingerprint.
 *
 * Run with: node --test tests/summarize-inputs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeInputs, summarizeInputDigests } from '../engine/src/inputs.ts';
import { buildExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';

// summarizeInputs reads (type, value, id, unit, bindToProfile) off each item; the
// full InputModelItem carries more, but a partial is enough to exercise the logic.
const item = (o: Record<string, unknown>): any => o;

test('keeps short scalar inputs (text, number, boolean, color, select, url, date/time)', () => {
  const out = summarizeInputs([
    item({ id: 'color', type: 'color', value: '#ffffff' }),
    item({ id: 'headline', type: 'text', value: 'short text here' }),
    item({ id: 'count', type: 'number', value: 3 }),
    item({ id: 'wrap', type: 'boolean', value: true }),
    item({ id: 'shape', type: 'select', value: 'circle' }),
    item({ id: 'link', type: 'url', value: 'https://x.co' }),
    item({ id: 'day', type: 'date', value: '2026-07-08' }),
  ]);
  assert.deepEqual(out, {
    color: '#ffffff', headline: 'short text here', count: '3',
    wrap: 'true', shape: 'circle', link: 'https://x.co', day: '2026-07-08',
  });
});

test('drops uploads, repeating groups, empties, and null/object values', () => {
  const out = summarizeInputs([
    item({ id: 'logo', type: 'asset', value: { id: 'a', source: 'user' } }),
    item({ id: 'doc', type: 'file', value: { bytes: new Uint8Array(4) } }),
    item({ id: 'rows', type: 'blocks', value: [{ x: 1 }] }),
    item({ id: 'xy', type: 'vector', value: [1, 2] }),
    item({ id: 'blank', type: 'text', value: '' }),
    item({ id: 'spaces', type: 'text', value: '   ' }),
    item({ id: 'nil', type: 'text', value: null }),
  ]);
  assert.deepEqual(out, {});
});

test('records text AND longtext in full - the exact rendered copy is a tamper signal', () => {
  const body = 'The quick brown fox jumped over the lazy dog. '.repeat(4).trim(); // ~180 chars
  const out = summarizeInputs([
    item({ id: 'headline', type: 'text', value: 'Summer Sale' }),
    item({ id: 'bio', type: 'longtext', value: body }),
  ]);
  // Neither truncated to the short-scalar sample - the full copy rides along.
  assert.equal(out.headline, 'Summer Sale');
  assert.equal(out.bio, body);
});

test('caps pathological text at TEXT_VALUE_CAP (4000) with an ellipsis', () => {
  const huge = 'y'.repeat(5000);
  const out = summarizeInputs([item({ id: 'essay', type: 'longtext', value: huge })]);
  const essay = out.essay ?? '';
  assert.equal(essay.length, 4000);
  assert.ok(essay.endsWith('…'));
});

test('never leaks profile-bound inputs (PII rides only via explicit authorship)', () => {
  const out = summarizeInputs([
    item({ id: 'firstname', type: 'text', value: 'Andy', bindToProfile: 'firstname' }),
    item({ id: 'title', type: 'text', value: 'Hello' }),
  ]);
  assert.deepEqual(out, { title: 'Hello' });
});

test('appends a number input’s unit, but not a string’s', () => {
  const out = summarizeInputs([
    item({ id: 'radius', type: 'number', value: 12, unit: 'mm' }),
    item({ id: 'label', type: 'text', value: 'plain', unit: 'mm' }),
  ]);
  assert.equal(out.radius, '12 mm');
  assert.equal(out.label, 'plain');
});

test('samples an over-long NON-text scalar (e.g. url) at maxValueLen with an ellipsis', () => {
  const long = 'https://example.com/' + 'x'.repeat(200);
  const out = summarizeInputs([item({ id: 'u', type: 'url', value: long })], { maxValueLen: 10 });
  const u = out.u ?? '';
  assert.equal(u.length, 10);
  assert.ok(u.endsWith('…'));
});

test('caps the number of entries', () => {
  const many = Array.from({ length: 50 }, (_, i) => item({ id: `k${i}`, type: 'text', value: `v${i}` }));
  const out = summarizeInputs(many, { maxEntries: 5 });
  assert.equal(Object.keys(out).length, 5);
});

test('export input fingerprints contain hashes instead of scalar values', async () => {
  const model = [item({ id: 'copy', type: 'longtext', value: 'Example text for a credential' }),
    item({ id: 'count', type: 'number', value: 12, unit: 'mm' })];
  const out = await summarizeInputDigests(model);
  assert.deepEqual(Object.keys(out), ['copy', 'count']);
  for (const value of Object.values(out)) assert.match(value, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(out).includes('Example text'), false);
  assert.deepEqual(await summarizeInputDigests(model), out);
  assert.notEqual((await summarizeInputDigests([item({ id: 'count', type: 'number', value: 13, unit: 'mm' })])).count, out.count);
});

test('export input fingerprints exclude profile fields and inactive controls', async () => {
  const out = await summarizeInputDigests([
    item({ id: 'enabled', type: 'boolean', value: false }),
    item({ id: 'person', type: 'text', value: 'Example person', bindToProfile: 'firstname' }),
    item({ id: 'unused', type: 'text', value: 'Example inactive copy', showIf: { enabled: true } }),
    item({ id: 'image', type: 'asset', value: { id: 'example/image' } }),
  ]);
  assert.deepEqual(Object.keys(out), ['enabled']);
});

test('export input fingerprints hash all text while bounding the entry count', async () => {
  const prefix = 'a'.repeat(5000);
  const first = await summarizeInputDigests([item({ id: 'copy', type: 'longtext', value: prefix + 'first' })]);
  const second = await summarizeInputDigests([item({ id: 'copy', type: 'longtext', value: prefix + 'second' })]);
  assert.notEqual(first.copy, second.copy);
  assert.equal(Object.keys(await summarizeInputDigests([
    item({ id: 'one', type: 'text', value: 'one' }), item({ id: 'two', type: 'text', value: 'two' }),
  ], { maxEntries: 1 })).length, 1);
});

test('Node exports use the same fingerprints and omit device details', async () => {
  const model = [
    item({ id: 'empty', type: 'text', value: '' }),
    item({ id: 'copy', type: 'longtext', value: 'Example source' }),
    item({ id: 'count', type: 'number', value: 12, unit: 'mm' }),
    item({ id: 'person', type: 'text', value: 'Example person', bindToProfile: 'firstname' }),
    item({ id: 'inactive', type: 'text', value: 'Example inactive', showIf: { count: 1 } }),
  ];
  const options = buildExportC2paOpts({ surface: 'cli', manifest: { id: 'example' }, model, format: 'svg' });
  const environment = options.environment as Record<string, unknown>;
  assert.deepEqual(environment.inputs, await summarizeInputDigests(model));
  assert.equal(environment.os, undefined);
  assert.equal(environment.engine, undefined);
  assert.equal(JSON.stringify(options).includes('Example source'), false);
});

test('empty model → empty digest (never throws)', () => {
  assert.deepEqual(summarizeInputs([]), {});
});
