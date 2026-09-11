// SPDX-License-Identifier: MPL-2.0
/**
 * The manager's PURE helpers (DOM-free): the fact/claim separation, the counts-only
 * summary, the refusal copy, and the create-flow scaffold's empty-rate invariant.
 * Run with the CSS stub loader:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/rate-cards-manager.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_RATECARD_TEMPLATE, refusalMessage, factLine, reportedSpeech, pricedSummary,
} from './rate-cards-manager.ts';
import type { RateCardEntry } from '../lib/rate-cards.ts';

const entry = (over: Partial<RateCardEntry> = {}): RateCardEntry => ({
  digest: 'ab12cd34ef567890',
  assetId: 'user/ratecards/ab12cd34ef567890',
  name: 'acme-2026.json',
  currency: 'EUR',
  lineCount: 6,
  pricedLineCount: 4,
  confidential: false,
  bytes: 2048,
  addedAt: Date.UTC(2026, 1, 14),
  ...over,
});

test('factLine holds only facts Lolly knows - never a claim from the file', () => {
  const line = factLine(entry({ issuerName: 'Acme Print' }));
  assert.match(line, /EUR/);
  assert.match(line, /ab12cd34ef567890/);
  assert.match(line, /kB/);
  assert.ok(!line.includes('Acme Print'), 'the issuer claim must not leak into the fact line');
});

test('reportedSpeech quotes the file and marks it unverified, or is null when silent', () => {
  const said = reportedSpeech(entry({ issuerName: 'Acme Print', issued: '2026-02-14' }));
  assert.ok(said);
  assert.match(said!, /The file says:/);
  assert.match(said!, /Acme Print/);
  assert.match(said!, /2026-02-14/);
  assert.match(said!, /has not verified/);
  // no claim → no reported-speech line at all
  assert.equal(reportedSpeech(entry({ issuerName: undefined, issued: undefined })), null);
});

test('pricedSummary is a COUNT, never money', () => {
  const s = pricedSummary(entry({ pricedLineCount: 4, lineCount: 6 }));
  assert.match(s, /4/);
  assert.match(s, /6/);
  // no currency symbol, no figure that reads as a price
  assert.ok(!/[€$£]/.test(s));
});

test('refusalMessage covers all three outcomes with distinct copy', () => {
  const a = refusalMessage('not-a-rate-card');
  const b = refusalMessage('no-priced-lines');
  const c = refusalMessage('example-card');
  assert.ok(a && b && c);
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});

test('the create-flow scaffold starts EVERY rate empty - no numeric rate anywhere', () => {
  const doc = JSON.parse(EMPTY_RATECARD_TEMPLATE) as {
    currency: string; minimumCharge: unknown;
    lines: Array<{ kind: string; rate: unknown; breaks?: Array<{ rate: unknown }> }>;
  };
  // structure is complete: one of every line kind is present
  const kinds = new Set(doc.lines.map((l) => l.kind));
  for (const k of ['perPlate', 'perSheet', 'perArea', 'perQuantity', 'perUnit', 'perJob']) {
    assert.ok(kinds.has(k), `scaffold is missing the ${k} kind`);
  }
  // and NOT ONE rate is a number - the whole design refuses an invented price
  assert.equal(doc.currency, '');
  assert.equal(doc.minimumCharge, '');
  for (const l of doc.lines) {
    assert.equal(typeof l.rate, 'string');
    assert.equal(l.rate, '');
    for (const b of l.breaks ?? []) assert.equal(b.rate, '');
  }
});
