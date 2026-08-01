// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog-shipped house rate card (Phase 5) — the validation the `validate-catalog`
 * ratecard branch composes: schema-valid is NOT the same as computable, so the branch
 * runs the SAME reader the drop path uses (parseRateCard), and additionally requires a
 * catalog card to be `confidential:true` so its trade rates are protected.
 *
 * NO real house card ships in the repo (no real rates may enter it): the cards here are
 * synthetic and live ONLY in this test, never as a mounted catalog asset. Phase 5 is the
 * mechanism, not a shipped card.
 *
 * Run: node --test "tests/rate-card-catalog.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';

import { parseRateCard, isRateCardError } from '../engine/src/rate-card.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ajv = new Ajv({ allErrors: true, strict: false });
const rateCardSchema = JSON.parse(readFileSync(join(ROOT, 'schemas/ratecard.schema.json'), 'utf8'));
const validateRateCard = ajv.compile(rateCardSchema);

const digestOf = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 16);

/**
 * Re-implements the validate-catalog branch's verdict for a candidate catalog card,
 * so the test pins the exact logic the script runs (schema + parseRateCard + the
 * confidential requirement) without importing the whole script's I/O.
 */
function catalogVerdict(obj: unknown): { ok: true } | { ok: false; reason: string } {
  const bytes = Buffer.from(JSON.stringify(obj), 'utf8');
  const card = parseRateCard(bytes, digestOf(bytes), validateRateCard);
  if (isRateCardError(card)) return { ok: false, reason: `refused: ${card.error}` };
  if (!card.confidential) return { ok: false, reason: 'not confidential:true' };
  return { ok: true };
}

/** A synthetic, schema-valid, non-example house card. Rates are fictional test
 *  numbers, present only in this test file — never shipped as a catalog asset. */
function houseCard(over: Record<string, unknown> = {}) {
  return {
    $format: 'lolly-ratecard',
    formatVersion: 1,
    currency: 'EUR',
    taxIncluded: false,
    confidential: true,
    issuer: { name: 'Test House Print' },
    lines: [
      { id: 'plate-setup', kind: 'perPlate', rate: 35 },
      { id: 'artwork', kind: 'perJob', rate: 120 },
    ],
    ...over,
  };
}

// ── acceptance ─────────────────────────────────────────────────────────────────

test('validate-catalog accepts a well-formed, non-example, confidential house card', () => {
  const v = catalogVerdict(houseCard());
  assert.deepEqual(v, { ok: true });
});

// ── rejection: broken shape / not computable ────────────────────────────────────

test('validate-catalog rejects a broken card (placeholder string rate → not-a-rate-card)', () => {
  const v = catalogVerdict(houseCard({
    lines: [{ id: 'plate-setup', kind: 'perPlate', rate: '<your rate>' }],
  }));
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /refused/);
});

test('validate-catalog rejects a card that prices nothing (no-priced-lines)', () => {
  // permissive-schema failure is not needed: every line disabled → no-priced-lines.
  // A perQuantity line with no quantityKind is disabled by parseRateCard.
  const v = catalogVerdict(houseCard({
    lines: [{ id: 'variants', kind: 'perQuantity', rate: 5 }], // missing quantityKind
  }));
  assert.equal(v.ok, false);
  assert.match((v as { reason: string }).reason, /refused: no-priced-lines/);
});

// ── rejection: the Phase 5 confidential requirement ─────────────────────────────

test('validate-catalog rejects a computable house card that is NOT confidential', () => {
  const v = catalogVerdict(houseCard({ confidential: false }));
  assert.deepEqual(v, { ok: false, reason: 'not confidential:true' });
});

test('validate-catalog rejects a house card with no confidential flag at all', () => {
  const card = houseCard();
  delete (card as Record<string, unknown>).confidential; // parseRateCard defaults it false
  const v = catalogVerdict(card);
  assert.deepEqual(v, { ok: false, reason: 'not confidential:true' });
});
