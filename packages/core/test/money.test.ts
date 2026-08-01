// SPDX-License-Identifier: MPL-2.0
/**
 * Money helper + serialised-artifact type tests.
 *
 * The load-bearing properties: the formatter respects each currency's OWN minor-unit
 * exponent (never a hardcoded /100), it refuses a bad currency and a non-integer
 * amount rather than inventing a fallback symbol or a plausible figure, and it never
 * emits a bare number. The serialised money object round-trips through JSON with every
 * rule-9 caveat present, carries no field named `total`, and self-describes its figure.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  formatMoney, formatFigure, monetaryFigure, minorUnitExponent,
  CurrencyError, MinorUnitError, COST_DISCLAIMER, COST_MEMBER,
} from '../src/money.ts';
import type { SerializedCost, MonetaryFigure } from '../src/money.ts';

// ─── The exponent is the currency's own, from Intl, never hardcoded ─────────────

test('minorUnitExponent reads each currency its own exponent', () => {
  assert.equal(minorUnitExponent('JPY'), 0); // zero-decimal
  assert.equal(minorUnitExponent('EUR'), 2);
  assert.equal(minorUnitExponent('USD'), 2);
  assert.equal(minorUnitExponent('BHD'), 3); // three-decimal
});

// ─── Formatting respects the exponent (a zero-decimal currency is not /100) ─────

test('formatMoney treats minor units per the currency exponent', () => {
  // 421050 minor units:
  //   EUR (exp 2) -> 4210.50
  //   JPY (exp 0) -> 421050 (a /100 hardcode would wrongly show 4210.5)
  //   BHD (exp 3) -> 421.050
  const eur = formatMoney({ minorUnits: 421050, currency: 'EUR', locale: 'en-IE' });
  const jpy = formatMoney({ minorUnits: 421050, currency: 'JPY', locale: 'en' });
  const bhd = formatMoney({ minorUnits: 421050, currency: 'BHD', locale: 'en' });

  assert.match(eur, /4[.,\s]?210[.,]50/);
  // The JPY major amount is the full 421050, proving no /100 was applied.
  assert.match(jpy.replace(/[^\d]/g, ''), /^421050$/);
  // BHD keeps three fraction digits.
  assert.match(bhd, /421[.,]050/);
});

test('formatMoney never emits a bare number: the currency is always present', () => {
  for (const currency of ['EUR', 'JPY', 'USD', 'BHD']) {
    const s = formatMoney({ minorUnits: 100000, currency, locale: 'en' });
    // Something non-digit, non-separator must accompany the digits (a symbol or the
    // ISO letters, per locale) — a bare "1000" would fail this.
    const nonNumeric = s.replace(/[\d.,\s ]/g, '');
    assert.ok(nonNumeric.length > 0, `expected a currency marker in ${JSON.stringify(s)}`);
  }
});

test('a zero amount still carries its currency (no dashed placeholder)', () => {
  const s = formatMoney({ minorUnits: 0, currency: 'EUR', locale: 'en-IE' });
  assert.ok(/0/.test(s));
  assert.ok(s.replace(/[\d.,\s ]/g, '').length > 0);
});

// ─── No default currency: a bad or missing code THROWS, never a fallback ────────

test('formatMoney throws a typed CurrencyError on an unusable currency', () => {
  assert.throws(() => formatMoney({ minorUnits: 100, currency: 'NOTACODE' }), CurrencyError);
  assert.throws(() => formatMoney({ minorUnits: 100, currency: '' }), CurrencyError);
  // The error names the offending code; it does not silently pick a default.
  try {
    formatMoney({ minorUnits: 100, currency: 'NOTACODE' });
    assert.fail('expected a throw');
  } catch (e) {
    assert.ok(e instanceof CurrencyError);
    assert.equal((e as CurrencyError).currency, 'NOTACODE');
  }
});

test('minorUnitExponent throws on a bad currency rather than defaulting to 2', () => {
  assert.throws(() => minorUnitExponent(''), CurrencyError);
  assert.throws(() => minorUnitExponent('NOPE'), CurrencyError);
});

// ─── No float in a subtotal: a non-integer minor amount is refused ──────────────

test('formatMoney refuses a non-integer minor amount', () => {
  assert.throws(() => formatMoney({ minorUnits: 4210.5, currency: 'EUR' }), MinorUnitError);
  assert.throws(() => formatMoney({ minorUnits: Number.NaN, currency: 'EUR' }), MinorUnitError);
  assert.throws(() => formatMoney({ minorUnits: Number.MAX_SAFE_INTEGER + 1, currency: 'EUR' }), MinorUnitError);
});

test('monetaryFigure refuses a non-integer amount and self-describes a good one', () => {
  assert.throws(() => monetaryFigure(1.5, 'EUR'), MinorUnitError);
  const fig = monetaryFigure(421050, 'EUR');
  assert.deepEqual(fig, { minorUnits: 421050, currency: 'EUR', exponent: 2 });
});

test('formatFigure formats a self-describing figure identically to formatMoney', () => {
  const fig: MonetaryFigure = { minorUnits: 421050, currency: 'JPY', exponent: 0 };
  assert.equal(formatFigure(fig, 'en'), formatMoney({ minorUnits: 421050, currency: 'JPY', locale: 'en' }));
});

// ─── The serialised money object (rule 9) round-trips with every caveat ─────────

test('SerializedCost round-trips through JSON with all rule-9 caveats present', () => {
  const cost: SerializedCost = {
    kind: 'estimate',
    isQuote: false,
    estimatedTotalFromSuppliedRates: { minorUnits: 421050, currency: 'EUR', exponent: 2 },
    bound: 'exact',
    coversLines: 6,
    ofLines: 6,
    excludesTax: true,
    usedExpiredRates: false,
    disclaimer: COST_DISCLAIMER,
    ratesFrom: {
      issuer: 'Acme Print',
      issued: '2026-02-14',
      validUntil: '2026-08-31',
      digest: 'sha256-abc',
      verified: false,
    },
    uncosted: [],
    workingRows: [
      {
        lineId: 'plate-setup',
        kind: 'perPlate',
        quantityKind: 'processPlates',
        quantity: 4,
        bound: 'exact',
        unit: 'plate',
        unitRate: 3500,
        subtotal: 14000,
        subtotalBound: 'exact',
      },
    ],
    adjustments: [
      { lineId: 'minimum-charge', kind: 'adjustment', reason: 'minimumCharge', from: 388050, to: 421050, delta: 33000 },
    ],
  };

  const round = JSON.parse(JSON.stringify(cost)) as SerializedCost;
  assert.deepEqual(round, cost);

  // Every rule-9 required caveat is present as a sibling.
  for (const key of ['kind', 'isQuote', 'disclaimer', 'ratesFrom', 'bound', 'coversLines', 'ofLines', 'excludesTax', 'usedExpiredRates', 'estimatedTotalFromSuppliedRates']) {
    assert.ok(key in round, `missing required caveat: ${key}`);
  }
  // There is NO field named `total`.
  assert.ok(!('total' in round));
  // The disclaimer is rule 6's sentence verbatim, with no currency symbol.
  assert.equal(round.disclaimer, COST_DISCLAIMER);
  assert.doesNotMatch(round.disclaimer, /[$€£¥]/);
  // The issuer is unverified reported speech.
  assert.equal(round.ratesFrom.verified, false);
  // The figure self-describes, so a consumer never reads minor units as major.
  assert.equal(round.estimatedTotalFromSuppliedRates?.currency, 'EUR');
  assert.equal(round.estimatedTotalFromSuppliedRates?.exponent, 2);
  // The member is `cost`.
  assert.equal(COST_MEMBER, 'cost');
});

test('partial coverage carries a null figure, never a zero or partial scalar', () => {
  const cost: SerializedCost = {
    kind: 'estimate',
    isQuote: false,
    estimatedTotalFromSuppliedRates: null, // rule 2: no scalar total when any line is uncosted
    bound: 'ceiling',
    coversLines: 4,
    ofLines: 7,
    excludesTax: true,
    usedExpiredRates: false,
    disclaimer: COST_DISCLAIMER,
    ratesFrom: { issuer: 'Acme Print', issued: '2026-02-14', validUntil: '2026-08-31', digest: 'sha256-abc', verified: false },
    uncosted: [
      { lineId: 'run', reason: 'no-sheet-size' },
      { lineId: 'spot-uv', reason: 'empty-rate' },
      { lineId: 'artwork', reason: 'no-rate' },
    ],
    workingRows: [],
    adjustments: [],
  };
  const round = JSON.parse(JSON.stringify(cost)) as SerializedCost;
  assert.equal(round.estimatedTotalFromSuppliedRates, null);
  assert.notEqual(round.estimatedTotalFromSuppliedRates, 0);
  assert.equal(round.uncosted.length, 3);
});
