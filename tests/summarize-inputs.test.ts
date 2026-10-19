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
import { buildExportC2paOpts, recordedDesignInFile } from '../packages/node-shell/src/c2pa-opts.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { injectSvgMeta } from '../engine/src/image-meta.ts';

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

// The design-system record (plans/319 A7) in the Node credential builder the CLI, TUI
// and MCP share: the same flat keys the web builder writes, only when the export's own
// metadata carries a record, so the record off means none of them in the credential.
test('Node credentials carry the design-system record only when the export recorded one', () => {
  const base = { surface: 'cli' as const, manifest: { id: 'chart', name: 'Chart' }, model: [], format: 'svg' };
  const without = buildExportC2paOpts(base).environment as Record<string, unknown>;
  for (const key of ['designSystem', 'designSystemLabel', 'designVersion', 'themes']) assert.equal(key in without, false, key);
  const off = buildExportC2paOpts({ ...base, meta: { } }).environment as Record<string, unknown>;
  assert.equal('designSystem' in off, false, 'a meta with the record off adds nothing');
  const on = buildExportC2paOpts({ ...base, meta: {
    designSystem: { id: 'acme', label: 'Acme' }, designVersion: '2026-10',
    themes: [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }],
  } }).environment as Record<string, unknown>;
  assert.equal(on.designSystem, 'acme');
  assert.equal(on.designSystemLabel, 'Acme');
  assert.equal(on.designVersion, '2026-10');
  assert.equal(on.themes, '[{"group":"colourway","id":"persimmon","kind":"colourway","name":"Persimmon"}]');
});

// What a Node shell tells the person an export recorded (the CLI's stderr line, the
// MCP result line) is read back from the delivered bytes, so it can never name a
// record the file does not hold.
test('a Node shell names only the design-system record the delivered bytes hold', async () => {
  const record = {
    designSystem: { id: 'acme', label: 'Acme' }, designVersion: '2026-10',
    themes: [{ group: 'colourway', kind: 'colourway' as const, id: 'persimmon', name: 'Persimmon' }],
  };
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>';
  const plain = new TextEncoder().encode(svgText);
  assert.equal(await recordedDesignInFile(plain, 'svg'), null, 'no metadata, no credential: nothing to name');
  const meta = { software: 'Lolly', source: 'https://lolly.tools/t/chart', tool: 'Chart', author: '', contact: '', description: 'Made with https://lolly.tools : Chart (Persimmon colourway)' };
  const described = new TextEncoder().encode(injectSvgMeta(svgText, { ...meta, ...record }));
  assert.deepEqual(await recordedDesignInFile(described, 'svg'), record, 'the file\'s own lolly: properties');
  const base = { surface: 'cli' as const, manifest: { id: 'chart', name: 'Chart' }, model: [], format: 'svg' };
  const signed = await embedC2pa(plain, 'svg', buildExportC2paOpts({ ...base, meta: record }));
  assert.deepEqual(await recordedDesignInFile(signed, 'svg'), record, 'the credential, when the file has no metadata of its own');
  const unsigned = await embedC2pa(plain, 'svg', buildExportC2paOpts(base));
  assert.equal(await recordedDesignInFile(unsigned, 'svg'), null, 'a credential without the record gives none');
  // A PDF's keywords were written from the export's own metadata, so that metadata is the PDF's record.
  const pdf = new TextEncoder().encode('%PDF-1.7\n');
  assert.deepEqual(await recordedDesignInFile(pdf, 'pdf', record), record);
  assert.equal(await recordedDesignInFile(pdf, 'pdf', {}), null, 'the record off: nothing to name');
  assert.equal(await recordedDesignInFile(pdf, 'png', record), null, 'only a PDF falls back to the export metadata');
});
