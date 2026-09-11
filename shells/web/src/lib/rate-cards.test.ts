// SPDX-License-Identifier: MPL-2.0
/**
 * Rate-card storage rail: ingest → validate → store, the two refusals + the
 * example-card guard, and the meta round-trip a row is rebuilt from.
 * Run directly:  node --test shells/web/src/lib/rate-cards.test.ts
 *
 * DOM-free: an in-memory host stands in for the assets bridge, and the digest
 * comes from the global WebCrypto `crypto.subtle` (Node 20+), the same path the
 * web shell uses. Nothing is stored on a refusal - asserted by reading the host back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ingestRateCard, listRateCards, removeRateCard, getRateCardBlob,
  isRateCardIngestFailure, USER_RATECARD_PREFIX,
} from './rate-cards.ts';
import type { RateCardsHost } from './rate-cards.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');

interface Stored { id: string; type: string; format: string; blob: Blob; meta?: Record<string, unknown> }

function makeHost(): RateCardsHost & { store: Map<string, Stored> } {
  const store = new Map<string, Stored>();
  return {
    store,
    assets: {
      async _uploadUserAsset(rec) { store.set(rec.id, rec as Stored); },
      async _deleteUserAsset(id) { store.delete(id); return undefined; },
      async _listUserAssets() {
        return [...store.values()].map((r) => ({ id: r.id, type: r.type, meta: r.meta }));
      },
      async _getBlob(id) { return store.get(id)?.blob ?? null; },
    },
  };
}

const fileOf = (json: unknown, name = 'card.json'): File =>
  new File([JSON.stringify(json)], name, { type: 'application/json' });

const VALID = {
  $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
  issuer: { name: 'Acme Print', issued: '2026-02-14' },
  lines: [
    { id: 'run', kind: 'perSheet', rate: 0.12 },
    { id: 'foil', kind: 'perPlate', rate: 45, finish: 'foil' },
  ],
};

test('a valid card stores once, with facts and issuer claim kept in separate meta fields', async () => {
  const host = makeHost();
  const r = await ingestRateCard(host, fileOf(VALID, 'acme-2026.json'));
  assert.ok(!isRateCardIngestFailure(r));
  if (isRateCardIngestFailure(r)) return;

  assert.equal(r.name, 'acme-2026.json');       // FACT: filename
  assert.equal(r.currency, 'EUR');
  assert.equal(r.lineCount, 2);
  assert.equal(r.pricedLineCount, 2);
  assert.equal(r.issuerName, 'Acme Print');      // CLAIM, its own field
  assert.equal(r.issued, '2026-02-14');
  assert.equal(r.confidential, false);
  assert.equal(r.assetId, `${USER_RATECARD_PREFIX}${r.digest}`);
  assert.match(r.digest, /^[0-9a-f]{16}$/);

  const stored = host.store.get(r.assetId)!;
  assert.equal(stored.type, 'ratecard');
  assert.equal(stored.format, 'json');
  assert.equal(stored.meta!.issuerName, 'Acme Print');
  assert.deepEqual(stored.meta!.tags, ['ratecard']);
});

test('re-dropping identical bytes is an idempotent overwrite (one row)', async () => {
  const host = makeHost();
  await ingestRateCard(host, fileOf(VALID));
  await ingestRateCard(host, fileOf(VALID));
  assert.equal(host.store.size, 1);
  assert.equal((await listRateCards(host)).length, 1);
});

test('listRateCards rebuilds a row from meta alone (no re-parse) and round-trips', async () => {
  const host = makeHost();
  const ingested = await ingestRateCard(host, fileOf(VALID, 'acme.json'));
  assert.ok(!isRateCardIngestFailure(ingested));
  const [row] = await listRateCards(host);
  assert.equal(row!.name, 'acme.json');
  assert.equal(row!.issuerName, 'Acme Print');
  assert.equal(row!.pricedLineCount, 2);
  assert.equal(row!.currency, 'EUR');
});

test('a card with no priced lines is refused (no-priced-lines) and stored NOTHING', async () => {
  const host = makeHost();
  // perQuantity with no quantityKind is schema-valid but disabled → nothing costable.
  const r = await ingestRateCard(host, fileOf({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [{ id: 'v', kind: 'perQuantity', rate: 5 }],
  }));
  assert.ok(isRateCardIngestFailure(r));
  if (isRateCardIngestFailure(r)) assert.equal(r.error, 'no-priced-lines');
  assert.equal(host.store.size, 0);
});

test('a non-card / bad-shape file is refused (not-a-rate-card) and stored NOTHING', async () => {
  const host = makeHost();
  const bad = await ingestRateCard(host, fileOf({ hello: 'world' }));
  assert.ok(isRateCardIngestFailure(bad) && bad.error === 'not-a-rate-card');
  // a $format-tagged file whose rate is a string still fails the shape
  const badRate = await ingestRateCard(host, fileOf({
    $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR',
    lines: [{ id: 'x', kind: 'perJob', rate: 'nope' }],
  }));
  assert.ok(isRateCardIngestFailure(badRate) && badRate.error === 'not-a-rate-card');
  assert.equal(host.store.size, 0);
});

test('the shipped example fixture is refused by digest (example-card), never stored', async () => {
  const host = makeHost();
  const bytes = readFileSync(join(REPO, 'tests', 'fixtures', 'ratecard.example.json'));
  const r = await ingestRateCard(host, new File([bytes], 'ratecard.example.json', { type: 'application/json' }));
  assert.ok(isRateCardIngestFailure(r));
  if (isRateCardIngestFailure(r)) assert.equal(r.error, 'example-card');
  assert.equal(host.store.size, 0);
});

test('removeRateCard deletes the bytes', async () => {
  const host = makeHost();
  const r = await ingestRateCard(host, fileOf(VALID));
  assert.ok(!isRateCardIngestFailure(r));
  if (isRateCardIngestFailure(r)) return;
  assert.ok(await getRateCardBlob(host, r.digest));
  await removeRateCard(host, r.digest);
  assert.equal(await getRateCardBlob(host, r.digest), null);
  assert.equal((await listRateCards(host)).length, 0);
});
