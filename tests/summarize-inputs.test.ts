/**
 * Unit tests for summarizeInputs (engine/src/inputs.ts) — the compact scalar-input
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

import { summarizeInputs } from '../engine/src/inputs.ts';

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

test('records text AND longtext in full — the exact rendered copy is a tamper signal', () => {
  const body = 'The quick brown fox jumped over the lazy dog. '.repeat(4).trim(); // ~180 chars
  const out = summarizeInputs([
    item({ id: 'headline', type: 'text', value: 'Summer Sale' }),
    item({ id: 'bio', type: 'longtext', value: body }),
  ]);
  // Neither truncated to the short-scalar sample — the full copy rides along.
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

test('empty model → empty digest (never throws)', () => {
  assert.deepEqual(summarizeInputs([]), {});
});
