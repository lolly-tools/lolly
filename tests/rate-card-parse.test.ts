// SPDX-License-Identifier: MPL-2.0
/**
 * parseRateCard — the reader for a dropped printer's rate card. No arithmetic
 * and no currency is exercised here (there is none in the module yet, Phase 3);
 * this covers parsing, the injected-schema gate, the extra-schema invariants, the
 * three refusals, and rule 10 (no fixture/doc/brand-pack card carries a numeric
 * rate). plans/preflight-and-cost.md §5-6.
 *
 * Run: node --test "tests/rate-card-parse.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';

import {
  parseRateCard, isRateCardError, EXAMPLE_RATECARD_DIGEST,
  type RateCard, type RateCardError,
} from '../engine/src/rate-card.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ajv = new Ajv({ allErrors: true, strict: false });
const rateCardSchema = JSON.parse(readFileSync(join(ROOT, 'schemas/ratecard.schema.json'), 'utf8'));
const validate = ajv.compile(rateCardSchema);

/** Accept anything — used to reach parseRateCard's OWN defensive checks
 *  independent of the strict schema (a looser injected validator is a real case:
 *  a bad field must degrade the LINE, not the whole card). */
const permissive = (): boolean => true;

const digestOf = (s: string): string =>
  createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex').slice(0, 16);

/** A minimal card that PASSES the strict schema (every rate is a number). Used
 *  only in tests — never shipped as a fixture (rule 10). */
function validCardJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    $format: 'lolly-ratecard',
    formatVersion: 1,
    currency: 'EUR',
    taxIncluded: false,
    lines: [
      { id: 'plate-setup', kind: 'perPlate', rate: 12 },
      { id: 'artwork', kind: 'perJob', rate: 40 },
    ],
    ...overrides,
  });
}

function asCard(r: RateCard | RateCardError): RateCard {
  assert.ok(!isRateCardError(r), `expected a card, got ${JSON.stringify(r)}`);
  return r as RateCard;
}

// ── a valid card parses ───────────────────────────────────────────────────────

test('a schema-valid card parses, keeps every line, defaults confidential false', () => {
  const json = validCardJson();
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.equal(card.currency, 'EUR');
  assert.equal(card.confidential, false);
  assert.equal(card.taxIncluded, false);
  assert.equal(card.lines.length, 2);
  assert.ok(card.lines.every((l) => !l.disabled), 'both lines are costable');
});

test('confidential:true is carried through', () => {
  const json = validCardJson({ confidential: true });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.equal(card.confidential, true);
});

// ── the example card is refused by digest ─────────────────────────────────────

test('the shipped §5 example is schema-INVALID (placeholder string rates)', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/ratecard.example.json'), 'utf8'));
  assert.equal(validate(doc), false, 'the example must fail the schema on purpose (rate is a number)');
});

test('the example card is refused by digest before anything else (example-card)', () => {
  const bytes = readFileSync(join(ROOT, 'tests/fixtures/ratecard.example.json'));
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  assert.equal(digest, EXAMPLE_RATECARD_DIGEST, 'EXAMPLE_RATECARD_DIGEST must track the shipped fixture');
  const r = parseRateCard(bytes, digest, validate);
  assert.ok(isRateCardError(r));
  assert.equal((r as RateCardError).error, 'example-card');
});

test('example-card wins even with a permissive validator (checked first)', () => {
  const r = parseRateCard('{"$format":"lolly-ratecard"}', EXAMPLE_RATECARD_DIGEST, permissive);
  assert.equal((r as RateCardError).error, 'example-card');
});

// ── the two ingest refusals ───────────────────────────────────────────────────

test('not-a-rate-card: non-JSON, wrong $format, and schema-invalid shape', () => {
  assert.equal((parseRateCard('not json at all', 'aaaaaaaaaaaaaaaa', validate) as RateCardError).error, 'not-a-rate-card');
  assert.equal((parseRateCard('{"$format":"something-else"}', 'bbbbbbbbbbbbbbbb', validate) as RateCardError).error, 'not-a-rate-card');
  // Tagged as a rate card but missing required `lines` → schema rejects.
  assert.equal((parseRateCard('{"$format":"lolly-ratecard","formatVersion":1,"currency":"EUR"}', 'cccccccccccccccc', validate) as RateCardError).error, 'not-a-rate-card');
});

test('no-priced-lines: validates but nothing is costable', () => {
  // A single perQuantity line with no quantityKind is disabled → nothing priced.
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [{ id: 'variant', kind: 'perQuantity', rate: 5 }],
  });
  const r = parseRateCard(json, digestOf(json), validate);
  assert.ok(isRateCardError(r));
  assert.equal((r as RateCardError).error, 'no-priced-lines');
});

// ── extra-schema invariants (a schema-valid card can still be non-computable) ──

test('breaks with no breakMode: those lines are flagged, the card survives', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    // no breakMode
    lines: [
      { id: 'run', kind: 'perSheet', rate: 0.1, breaks: [{ min: 1, rate: 0.1 }, { min: 500, rate: 0.08 }] },
      { id: 'artwork', kind: 'perJob', rate: 40 },
    ],
  });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  const run = card.lines.find((l) => l.id === 'run')!;
  const artwork = card.lines.find((l) => l.id === 'artwork')!;
  assert.deepEqual(run.disabled, { reason: 'needs-break-mode' });
  assert.equal(artwork.disabled, undefined, 'the un-broken line stays costable');
});

test('breaks WITH breakMode are accepted', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR', breakMode: 'flat',
    lines: [{ id: 'run', kind: 'perSheet', rate: 0.1, breaks: [{ min: 1, rate: 0.1 }, { min: 500, rate: 0.08 }] }],
  });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.equal(card.lines[0]!.disabled, undefined);
  assert.equal(card.breakMode, 'flat');
});

test('breaks not starting at min:1, or not ascending, disable the line (bad-rate)', () => {
  const bad = (breaks: unknown) => JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR', breakMode: 'flat',
    lines: [
      { id: 'run', kind: 'perSheet', rate: 0.1, breaks },
      { id: 'artwork', kind: 'perJob', rate: 40 },
    ],
  });
  for (const breaks of [
    [{ min: 2, rate: 0.1 }],                          // first min !== 1
    [{ min: 1, rate: 0.1 }, { min: 1, rate: 0.08 }],  // not strictly ascending
    [{ min: 1, rate: 0.1 }, { min: 300, rate: 0.08 }, { min: 200, rate: 0.07 }], // descending
  ]) {
    // permissive validator: the schema does not order breaks, parseRateCard does.
    const json = bad(breaks);
    const card = asCard(parseRateCard(json, digestOf(json), permissive));
    assert.deepEqual(card.lines.find((l) => l.id === 'run')!.disabled, { reason: 'bad-rate' },
      `breaks ${JSON.stringify(breaks)} should disable the line`);
  }
});

test('a bad rate disables only its own line, not the card (permissive validator)', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [
      { id: 'plate-setup', kind: 'perPlate', rate: 'oops' },   // schema would reject; a looser validator would not
      { id: 'artwork', kind: 'perJob', rate: 40 },
    ],
  });
  const card = asCard(parseRateCard(json, digestOf(json), permissive));
  assert.deepEqual(card.lines.find((l) => l.id === 'plate-setup')!.disabled, { reason: 'bad-rate' });
  assert.equal(card.lines.find((l) => l.id === 'artwork')!.disabled, undefined);
});

test('perQuantity with no quantityKind is disabled; with one, costable', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [
      { id: 'v1', kind: 'perQuantity', rate: 5 },
      { id: 'v2', kind: 'perQuantity', rate: 5, quantityKind: 'variantRows' },
    ],
  });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.deepEqual(card.lines.find((l) => l.id === 'v1')!.disabled, { reason: 'missing-quantity-kind' });
  assert.equal(card.lines.find((l) => l.id === 'v2')!.disabled, undefined);
});

test('an unknown finish disables the line and is reported (never discarded)', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [
      { id: 'foil', kind: 'perPlate', rate: 20, finish: 'foil' },            // known
      { id: 'myst', kind: 'perPlate', rate: 20, finish: 'thermography' },    // house process
    ],
  });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.equal(card.lines.find((l) => l.id === 'foil')!.disabled, undefined);
  const myst = card.lines.find((l) => l.id === 'myst')!;
  assert.deepEqual(myst.disabled, { reason: 'unknown-finish' });
  assert.equal(myst.finish, 'thermography', 'the finish string is kept, not dropped');
});

test('a duplicate line id keeps the first and disables the later one', () => {
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [
      { id: 'dup', kind: 'perJob', rate: 10 },
      { id: 'dup', kind: 'perJob', rate: 99 },
    ],
  });
  const card = asCard(parseRateCard(json, digestOf(json), validate));
  assert.equal(card.lines[0]!.disabled, undefined);
  assert.equal(card.lines[0]!.rate, 10, 'the first wins');
  assert.deepEqual(card.lines[1]!.disabled, { reason: 'bad-rate' });
});

// ── currency: well-formedness via Intl.NumberFormat ───────────────────────────

test('a malformed currency is refused via Intl.NumberFormat (not-a-rate-card)', () => {
  // The strict schema pattern ^[A-Z]{3}$ already rejects this; a permissive
  // validator lets it through to parseRateCard's own Intl guard, which throws.
  const json = JSON.stringify({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EU',
    lines: [{ id: 'artwork', kind: 'perJob', rate: 40 }],
  });
  assert.equal((parseRateCard(json, digestOf(json), permissive) as RateCardError).error, 'not-a-rate-card');
});

test('a well-formed currency is accepted', () => {
  const json = validCardJson({ currency: 'USD' });
  assert.equal(asCard(parseRateCard(json, digestOf(json), validate)).currency, 'USD');
});

// ── rule 10: no shipped .json rate card carries a numeric rate ─────────────────

function anyNumericRate(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(anyNumericRate);
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if ((k === 'rate' || k === 'minimumCharge') && typeof val === 'number') return true;
      if (anyNumericRate(val)) return true;
    }
  }
  return false;
}

function walkJson(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build' ||
        name === 'coverage' || name === 'tools' || name === 'catalog') continue;
    const abs = join(dir, name);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walkJson(abs, out);
    else if (name.endsWith('.json')) out.push(abs);
  }
}

test('rule 10: no shipped .json rate card contains a numeric rate', () => {
  const files: string[] = [];
  walkJson(ROOT, files);
  let scanned = 0;
  for (const abs of files) {
    let doc;
    try { doc = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
    if (!doc || typeof doc !== 'object' || doc.$format !== 'lolly-ratecard') continue;
    scanned++;
    assert.ok(!anyNumericRate(doc),
      `${abs} is a rate card carrying a numeric rate — every shipped card must keep placeholder rates (rule 10)`);
  }
  assert.ok(scanned >= 1, 'expected at least the §5 example fixture to be scanned');
  console.log(`  scanned ${scanned} shipped rate-card .json file(s)`);
});
