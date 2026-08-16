// SPDX-License-Identifier: MPL-2.0
/**
 * computeCost - the Phase 4 arithmetic. Multiplies rates FROM THE CARD by
 * quantities preflight COUNTED, in integer minor units, and returns a structured
 * working. The one invariant above all: never invent money.
 *
 * The rates below are TEST values, never shipped as data (rule 10 scans .json
 * fixtures, not this .test.ts). Amounts authored in MAJOR units, e.g. `38` EUR
 * becomes `3800` minor units at exponent 2 - that is the "3800 minor units" the
 * task refers to.
 *
 * Run: node --test "tests/rate-card-cost.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeCost } from '../engine/src/rate-card.ts';
import type { RateCard, RateCardLine } from '../engine/src/rate-card.ts';
import type { Count } from '../packages/core/src/index.ts';

// ── builders ──────────────────────────────────────────────────────────────────

function makeCard(lines: RateCardLine[], over: Partial<RateCard> = {}): RateCard {
  return {
    digest: 'deadbeefdeadbeef',
    formatVersion: 1,
    currency: 'EUR',
    taxIncluded: false,
    issuer: {},
    confidential: false,
    lines,
    ...over,
  };
}

function count(kind: Count['kind'], value: number, over: Partial<Count> = {}): Count {
  return { kind, value, unit: 'row', bound: 'exact', basis: 'test', ...over };
}

/** Sum every visible row + adjustment delta - must equal the headline (rule 3). */
function visibleSum(w: ReturnType<typeof computeCost>): number {
  const rowSum = w.rows.reduce((s, r) => s + r.subtotal, 0);
  const adjSum = w.adjustments.reduce((s, a) => s + a.delta, 0);
  return rowSum + adjSum;
}

// ── the two break modes on one worked 1200-unit run (rule: no default) ──────────

// Line: perQuantity over variantRows, two breaks. R1 = 10.00 (1000 minor),
// R2 = 5.50 (550 minor), q = 1200. Flat prices all 1200 at R2; marginal prices
// 1-499 at R1 and 500-1200 at R2. See the break-semantics brief.
const RUN_LINE: RateCardLine = {
  id: 'run',
  kind: 'perQuantity',
  quantityKind: 'variantRows',
  rate: 10, // ignored when breaks are present
  breaks: [
    { min: 1, rate: 10 }, // R1 = 1000 minor
    { min: 500, rate: 5.5 }, // R2 = 550 minor
  ],
};
const RUN_COUNTS = [count('variantRows', 1200)];

test('flat-tier prices every unit at the last min<=q tier (1200 x 550)', () => {
  const w = computeCost(makeCard([RUN_LINE], { breakMode: 'flat' }), RUN_COUNTS);
  assert.equal(w.rows.length, 1);
  assert.equal(w.rows[0]!.unitRate, 550);
  assert.equal(w.rows[0]!.quantity, 1200);
  assert.equal(w.rows[0]!.subtotal, 660000); // 1200 * 550
  assert.deepEqual(w.rows[0]!.breakApplied, { mode: 'flat', min: 500 });
  assert.equal(w.subtotalOfCovered, 660000);
});

test('marginal prices each band at its own rate (499 x 1000 + 701 x 550)', () => {
  const w = computeCost(makeCard([RUN_LINE], { breakMode: 'marginal' }), RUN_COUNTS);
  assert.equal(w.rows.length, 2, 'one row per band');
  assert.deepEqual(w.rows[0]!.breakApplied, { mode: 'marginal', min: 1, upTo: 499 });
  assert.equal(w.rows[0]!.quantity, 499);
  assert.equal(w.rows[0]!.subtotal, 499000); // 499 * 1000
  assert.deepEqual(w.rows[1]!.breakApplied, { mode: 'marginal', min: 500, upTo: 1200 });
  assert.equal(w.rows[1]!.quantity, 701);
  assert.equal(w.rows[1]!.subtotal, 385550); // 701 * 550
  assert.equal(w.subtotalOfCovered, 884550);
});

test('marginal exceeds flat by ~34% on a realistic break — flat is the cheaper reading', () => {
  const flat = computeCost(makeCard([RUN_LINE], { breakMode: 'flat' }), RUN_COUNTS).subtotalOfCovered;
  const marginal = computeCost(makeCard([RUN_LINE], { breakMode: 'marginal' }), RUN_COUNTS).subtotalOfCovered;
  assert.equal(flat, 660000);
  assert.equal(marginal, 884550);
  assert.ok(marginal > flat, 'flat is always cheaper when rates descend');
  const gap = (marginal - flat) / flat;
  assert.ok(gap > 0.33 && gap < 0.35, `expected ~34%, got ${(gap * 100).toFixed(1)}%`);
});

test('a card with breaks and NO breakMode leaves those lines uncosted, never guessed', () => {
  // The reader disables such a line (needs-break-mode); computeCost reports it.
  const line: RateCardLine = { ...RUN_LINE, disabled: { reason: 'needs-break-mode' } };
  const w = computeCost(makeCard([line]), RUN_COUNTS); // no breakMode on the card
  assert.equal(w.rows.length, 0);
  assert.deepEqual(w.uncosted, [{ lineId: 'run', reason: 'needs-break-mode' }]);
  assert.equal(w.estimatedTotal, null, 'no total when a line is uncosted (rule 2)');
});

// ── integer minor units, no floats ──────────────────────────────────────────────

test('every amount is an integer number of minor units (no float artefacts)', () => {
  const w = computeCost(makeCard([RUN_LINE], { breakMode: 'marginal' }), RUN_COUNTS);
  for (const r of w.rows) {
    assert.ok(Number.isInteger(r.unitRate), 'unitRate integer');
    assert.ok(Number.isInteger(r.subtotal), 'subtotal integer');
  }
  assert.ok(Number.isInteger(w.subtotalOfCovered));
  // 5.5 * 100 in binary float is exactly 550 after Math.round - pin it.
  assert.equal(w.rows[1]!.unitRate, 550);
});

// ── rule 3: the visible rows (+ adjustments) sum to the headline, exactly ────────

test('rows plus adjustment deltas sum to the headline, exactly', () => {
  const w = computeCost(
    makeCard([RUN_LINE, { id: 'art', kind: 'perJob', rate: 38 }], { breakMode: 'marginal', minimumCharge: 12000 }),
    RUN_COUNTS,
  );
  assert.ok(w.estimatedTotal, 'full coverage -> a headline');
  assert.equal(visibleSum(w), w.estimatedTotal!.minorUnits);
});

// ── minimum charge is a VISIBLE adjustment row, never a silent floor (rule 3) ────

test('minimum charge shows as an adjustment row and floors the headline', () => {
  // One perJob line at 38.00 (3800 minor); minimum 200.00 (20000 minor).
  const w = computeCost(
    makeCard([{ id: 'art', kind: 'perJob', rate: 38 }], { minimumCharge: 200 }),
    [],
  );
  assert.equal(w.subtotalOfCovered, 3800);
  assert.equal(w.adjustments.length, 1);
  assert.deepEqual(w.adjustments[0], {
    lineId: 'minimum-charge',
    kind: 'adjustment',
    reason: 'minimumCharge',
    from: 3800,
    to: 20000,
    delta: 16200,
  });
  assert.equal(w.estimatedTotal!.minorUnits, 20000, 'headline = the floor');
  assert.equal(visibleSum(w), 20000, 'the visible rows still sum to the headline');
});

test('minimum charge below the subtotal adds no row and does not change the headline', () => {
  const w = computeCost(
    makeCard([{ id: 'art', kind: 'perJob', rate: 500 }], { minimumCharge: 200 }),
    [],
  );
  assert.equal(w.adjustments.length, 0);
  assert.equal(w.estimatedTotal!.minorUnits, 50000);
});

test('minimum charge is NOT applied while any line is uncosted (rule 2 wins first)', () => {
  const w = computeCost(
    makeCard(
      [{ id: 'run', kind: 'perSheet', rate: 1 }, { id: 'art', kind: 'perJob', rate: 38 }],
      { minimumCharge: 999 },
    ),
    [], // no sheet count -> perSheet uncosted
  );
  assert.equal(w.adjustments.length, 0, 'no floor on a partial card');
  assert.equal(w.estimatedTotal, null);
});

// ── rule 2: any uncosted line -> NO scalar total ────────────────────────────────

test('any uncosted line means no scalar total; the gap is reported', () => {
  const w = computeCost(
    makeCard([
      { id: 'run', kind: 'perSheet', rate: 2 }, // no sheet count
      { id: 'art', kind: 'perJob', rate: 38 }, // priced
    ]),
    [],
  );
  assert.equal(w.estimatedTotal, null, 'no total to copy');
  assert.equal(w.coveredLines, 1);
  assert.equal(w.totalLines, 2);
  assert.deepEqual(w.uncosted, [{ lineId: 'run', reason: 'no-sheet-count' }]);
  assert.equal(w.subtotalOfCovered, 3800, 'per-line arithmetic still visible');
  assert.equal(w.coveredLines + w.uncosted.length, w.totalLines);
});

test('perArea with no sheet-area count is a named gap, not zero', () => {
  const w = computeCost(makeCard([{ id: 'uv', kind: 'perArea', unit: 'm2-sheet', rate: 5 }]), []);
  assert.deepEqual(w.uncosted, [{ lineId: 'uv', reason: 'no-sheet-area' }]);
  assert.equal(w.estimatedTotal, null);
});

test('perQuantity naming a kind the job did not produce is a named gap', () => {
  const w = computeCost(
    makeCard([{ id: 'v', kind: 'perQuantity', quantityKind: 'variantRows', rate: 3 }]),
    [count('pages', 10)], // job produced pages, not variantRows
  );
  assert.deepEqual(w.uncosted, [{ lineId: 'v', reason: 'quantity-not-produced' }]);
  assert.equal(w.estimatedTotal, null);
});

// ── sub-minor-unit rates: the rate is NOT rounded before multiplying ─────────────

test('a sub-cent per-unit rate is neither inflated nor zeroed; subtotal rounds once', () => {
  // 0.008 EUR per impression over 100,000 impressions = 800.00 exactly, never 1000.00
  // (rate rounded up to 1 minor) nor 0 (rate rounded to 0 minor, silently omitted).
  const w = computeCost(
    makeCard([{ id: 'press', kind: 'perQuantity', quantityKind: 'sheets', rate: 0.008 }]),
    [count('sheets', 100000)],
  );
  assert.equal(w.rows.length, 1);
  assert.equal(w.rows[0]!.subtotal, 80000, '100000 x 0.008 EUR = 800.00, not 1000.00');
  assert.ok(Number.isInteger(w.rows[0]!.subtotal));
  assert.equal(w.estimatedTotal!.minorUnits, 80000);

  // 0.004 rounds to 0 minor per unit - the buggy path priced this line at nothing while
  // still counting it as covered. The honest figure is 400.00.
  const w2 = computeCost(
    makeCard([{ id: 'press', kind: 'perQuantity', quantityKind: 'sheets', rate: 0.004 }]),
    [count('sheets', 100000)],
  );
  assert.equal(w2.rows[0]!.subtotal, 40000, '100000 x 0.004 EUR = 400.00, never 0');
  assert.equal(w2.estimatedTotal!.minorUnits, 40000);
});

test('a fractional quantity (area m2) yields an integer minor-unit subtotal, never throws', () => {
  // A perArea line at 5.00 EUR/m2 over a 0.07688 m2 media box: 0.3844 EUR = 38.44,
  // rounded once. The pre-fix path left 38.44 as a non-integer minor amount -> MinorUnitError.
  const w = computeCost(
    makeCard([{ id: 'uv', kind: 'perArea', unit: 'm2-sheet', rate: 5 }]),
    [count('area', 0.07688, { unit: 'm2-sheet', box: 'media' })],
  );
  assert.equal(w.rows.length, 1);
  assert.ok(Number.isInteger(w.rows[0]!.subtotal), 'subtotal is integer minor units');
  assert.equal(w.rows[0]!.subtotal, Math.round(0.07688 * 500)); // 38.44 -> 3844
  assert.ok(w.estimatedTotal, 'a full-coverage figure exists (no throw)');
});

// ── perArea prices the MEDIA box only, never trim+bleed+media summed (finding 4) ──

test('a single perArea line prices the media box alone, not all three area boxes', () => {
  // checkPrintGeometry emits three m2-sheet area counts; a perArea line must consume
  // only the media box (the whole sheet through the press), else it triples the cost.
  const counts: Count[] = [
    count('area', 0.06237, { unit: 'm2-sheet', box: 'trim' }),
    count('area', 0.06545, { unit: 'm2-sheet', box: 'bleed' }),
    count('area', 0.07688, { unit: 'm2-sheet', box: 'media' }),
  ];
  const w = computeCost(makeCard([{ id: 'uv', kind: 'perArea', unit: 'm2-sheet', rate: 500 }]), counts);
  assert.equal(w.rows.length, 1, 'exactly one perArea row, not three');
  assert.equal(w.rows[0]!.box, 'media');
  assert.equal(w.rows[0]!.subtotal, Math.round(0.07688 * 50000)); // media only
  assert.equal(w.coveredLines, 1);
});

// ── rule 4: ceiling propagation ─────────────────────────────────────────────────

test('a ceiling count yields a ceiling subtotal and a ceiling total', () => {
  const w = computeCost(
    makeCard([{ id: 'plate-setup', kind: 'perPlate', rate: 12 }]),
    [
      count('processPlates', 4, { unit: 'plate', bound: 'exact' }),
      count('spotPlates', 2, { unit: 'plate', bound: 'ceiling' }),
    ],
  );
  assert.equal(w.rows.length, 2, 'one row per matched plate count');
  const spot = w.rows.find((r) => r.quantityKind === 'spotPlates')!;
  assert.equal(spot.subtotalBound, 'ceiling');
  assert.equal(spot.subtotal, 2400); // 2 * 1200 minor, "up to"
  const proc = w.rows.find((r) => r.quantityKind === 'processPlates')!;
  assert.equal(proc.subtotalBound, 'exact');
  assert.equal(w.bound, 'ceiling', 'any ceiling row makes the whole total a ceiling');
  assert.ok(w.estimatedTotal, 'still a full-coverage total, carried as up-to');
  assert.equal(w.estimatedTotal!.minorUnits, 7200); // (4 + 2) * 1200
});

test('an all-exact job carries an exact bound', () => {
  const w = computeCost(
    makeCard([{ id: 'plate-setup', kind: 'perPlate', rate: 12 }]),
    [count('processPlates', 4, { unit: 'plate', bound: 'exact' })],
  );
  assert.equal(w.bound, 'exact');
});

// ── perUnit is inert without a user-entered run length; never defaults to 1 ──────

test('perUnit with no run length stays inert (uncosted gap), never defaults to 1', () => {
  const line: RateCardLine = { id: 'copies', kind: 'perUnit', rate: 2 };
  const w = computeCost(makeCard([line]), []);
  assert.deepEqual(w.uncosted, [{ lineId: 'copies', reason: 'no-run-length' }]);
  assert.equal(w.estimatedTotal, null);
  assert.equal(w.rows.length, 0);
});

test('perUnit prices the user-entered run length once supplied', () => {
  const line: RateCardLine = { id: 'copies', kind: 'perUnit', rate: 2 };
  const w = computeCost(makeCard([line]), [], { runLength: 1000 });
  assert.equal(w.rows.length, 1);
  assert.equal(w.rows[0]!.quantityKind, 'runLength');
  assert.equal(w.rows[0]!.quantity, 1000);
  assert.equal(w.rows[0]!.subtotal, 200000); // 1000 * 200 minor
  assert.equal(w.estimatedTotal!.minorUnits, 200000);
});

// ── an unrecognised finish disables the line and is reported (reader -> cost) ────

test('an unrecognised-finish line (reader-disabled) is reported and blocks the total', () => {
  const line: RateCardLine = {
    id: 'house-finish',
    kind: 'perPlate',
    rate: 9,
    finish: 'unobtanium-emboss',
    disabled: { reason: 'unknown-finish' },
  };
  const w = computeCost(makeCard([line]), [count('finishPlates', 1, { unit: 'plate' })]);
  assert.deepEqual(w.uncosted, [{ lineId: 'house-finish', reason: 'unknown-finish' }]);
  assert.equal(w.estimatedTotal, null);
});

// ── expiry is REPORTED, not acted on (the caller suppresses) ─────────────────────

test('expired is reported as a field; the arithmetic still runs (caller decides UI)', () => {
  const past = makeCard([{ id: 'art', kind: 'perJob', rate: 38 }], {
    issuer: { validUntil: '2000-01-01' },
  });
  const w = computeCost(past, [], { now: Date.parse('2026-01-01') });
  assert.equal(w.expired, true);
  assert.ok(w.estimatedTotal, 'computeCost does not suppress; it reports expired');
});

test('a valid (or unparseable) validUntil is not expired', () => {
  const future = makeCard([{ id: 'art', kind: 'perJob', rate: 38 }], {
    issuer: { validUntil: '2999-01-01' },
  });
  assert.equal(computeCost(future, [], { now: Date.parse('2026-01-01') }).expired, false);
  const junk = makeCard([{ id: 'art', kind: 'perJob', rate: 38 }], { issuer: { validUntil: '…' } });
  assert.equal(computeCost(junk, [], { now: Date.parse('2026-01-01') }).expired, false);
});

// ── the self-describing figure carries currency + exponent, no formatting ────────

test('the total is a self-describing MonetaryFigure (minor units + currency + exponent)', () => {
  const w = computeCost(makeCard([{ id: 'art', kind: 'perJob', rate: 38 }]), []);
  assert.deepEqual(w.estimatedTotal, { minorUnits: 3800, currency: 'EUR', exponent: 2 });
  assert.equal(w.currency, 'EUR');
});

test('a zero-exponent currency (JPY) needs no /100 anywhere', () => {
  const w = computeCost(
    makeCard([{ id: 'art', kind: 'perJob', rate: 3800 }], { currency: 'JPY' }),
    [],
  );
  assert.deepEqual(w.estimatedTotal, { minorUnits: 3800, currency: 'JPY', exponent: 0 });
});
