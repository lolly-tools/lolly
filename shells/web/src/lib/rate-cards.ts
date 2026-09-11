// SPDX-License-Identifier: MPL-2.0
/**
 * Rate cards the user supplied - a JSON card their printer gave them, dropped on
 * this device, parsed and validated but NEVER a source of prices.
 *
 * This is the storage rail, modelled line-for-line on `lib/color-profiles.ts`: a
 * card is a `type:'ratecard'` USER ASSET at `user/ratecards/<digest>`, so the
 * storage meter counts it, "Export my data" bundles the bytes, a backup import
 * restores them and clear-all wipes them. No parallel object store, no new bridge
 * method - the same four `_uploadUserAsset`/`_deleteUserAsset`/`_listUserAssets`/
 * `_getBlob` methods every user-asset kind rides.
 *
 * The id is CONTENT-ADDRESSED - `<digest>` is the same 16-hex SHA-256 prefix the
 * ICC path mints - so re-dropping the same file overwrites rather than
 * duplicating, and a `rate=<digest>` selection (Phase 4/5) matches a locally
 * stored card by construction rather than by filename luck. Because it is the raw
 * file's own content, `parseRateCard`'s `example-card` refusal is a stable digest
 * comparison.
 *
 * Two ingest refusals (`not-a-rate-card`, `no-priced-lines`) plus the
 * `example-card` guard - the same two-refusal discipline `ingestProfile` follows
 * (`unreadable`/`no-gamut`). Nothing is stored on any refusal.
 *
 * NO ARITHMETIC AND NO MONEY here - this module stores and validates. It records
 * the facts a row needs (filename, digest, currency, line counts) plus the
 * issuer's own CLAIMS (name/issued/validUntil) as REPORTED SPEECH kept in
 * separate fields, so the panel can render "the file says …, Lolly has not
 * verified this" without ever merging a claim into a fact. It never formats a
 * currency figure; that is Phase 4's export panel.
 */

import { parseRateCard, isRateCardError, validateRateCard } from '@lolly/engine';
import type { RateCard } from '@lolly/engine';

/** Every stored rate-card asset id starts with this. */
export const USER_RATECARD_PREFIX = 'user/ratecards/';

/** The slice of the web bridge this module drives (identical to ColorProfilesHost). */
export interface RateCardsHost {
  assets: {
    _uploadUserAsset(record: {
      id: string; type: string; format: string; blob: Blob;
      version?: string; meta?: Record<string, unknown>;
    }): Promise<void>;
    _deleteUserAsset(id: string): Promise<unknown>;
    _listUserAssets(): Promise<Array<{ id: string; type: string; meta?: Record<string, unknown> }>>;
    _getBlob(id: string): Promise<Blob | null>;
  };
}

/**
 * One stored card, rendered from `meta` alone - the panel never re-parses to draw
 * a row. Two layers kept deliberately apart:
 *  - FACTS Lolly knows: `digest`, `name` (the dropped filename), `addedAt`,
 *    `currency`, the line counts.
 *  - CLAIMS the file makes: `issuerName`/`issued`/`validUntil` - reported speech,
 *    rendered separately and never merged with the facts.
 */
export interface RateCardEntry {
  /** 16 hex chars; the content identity. */
  digest: string;
  /** `user/ratecards/<digest>` for a dropped card; the catalog asset id for a
   *  catalog-shipped one (see listCatalogRateCards). */
  assetId: string;
  /** Set on catalog-shipped cards only: where the bytes re-read from. Its
   *  absence is what distinguishes a user-dropped card. */
  catalogUrl?: string;
  /** The dropped filename - a FACT, for a row the user can recognise. */
  name: string;
  /** The issuer name the FILE claims. Unverified reported speech. */
  issuerName?: string;
  /** The issue date the FILE claims. Unverified. */
  issued?: string;
  /** The valid-until date the FILE claims. Unverified. */
  validUntil?: string;
  /** ISO 4217, from the card. There is no default currency anywhere. */
  currency: string;
  /** How many lines the card declares. */
  lineCount: number;
  /** How many of them carry a usable numeric rate (the rest report "counted only"). */
  pricedLineCount: number;
  /** Phase 5 catalog-shipped house card. */
  confidential: boolean;
  bytes: number;
  addedAt: number;
}

export type RateCardIngestFailure = { error: 'not-a-rate-card' | 'no-priced-lines' | 'example-card' };

export const isRateCardIngestFailure = (
  r: RateCardEntry | RateCardIngestFailure,
): r is RateCardIngestFailure => 'error' in r;

/** The content digest - the same 16-hex lowercase SHA-256 prefix the ICC path mints. */
async function digestOf(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** How many priced lines a parsed card has (a line with no `disabled` marker). */
function pricedCount(card: RateCard): number {
  return card.lines.filter((l) => !l.disabled).length;
}

/** The facts + claims a stored row carries, built from a freshly parsed card. */
function entryFromCard(card: RateCard, name: string, bytes: number): RateCardEntry {
  const issuer = card.issuer ?? {};
  const entry: RateCardEntry = {
    digest: card.digest,
    assetId: `${USER_RATECARD_PREFIX}${card.digest}`,
    name,
    currency: card.currency,
    lineCount: card.lines.length,
    pricedLineCount: pricedCount(card),
    confidential: card.confidential,
    bytes,
    addedAt: Date.now(),
  };
  if (typeof issuer.name === 'string' && issuer.name.trim()) entry.issuerName = issuer.name;
  if (typeof issuer.issued === 'string' && issuer.issued.trim()) entry.issued = issuer.issued;
  if (typeof issuer.validUntil === 'string' && issuer.validUntil.trim()) entry.validUntil = issuer.validUntil;
  return entry;
}

/**
 * Read a dropped rate card, validate it, store it, and return its row - or one of
 * three refusals, storing NOTHING. Re-dropping the same bytes is an idempotent
 * overwrite (same digest, same asset id), exactly like `ingestProfile`.
 */
export async function ingestRateCard(
  host: RateCardsHost, file: File | Blob,
): Promise<RateCardEntry | RateCardIngestFailure> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { error: 'not-a-rate-card' };
  }
  const digest = await digestOf(bytes);
  const card = parseRateCard(bytes, digest, validateRateCard);
  if (isRateCardError(card)) return { error: card.error };

  const name = (file as File).name || `ratecard-${digest}.json`;
  const entry = entryFromCard(card, name, bytes.byteLength);
  await host.assets._uploadUserAsset({
    id: entry.assetId,
    type: 'ratecard',
    format: 'json',
    blob: new Blob([bytes as unknown as BlobPart], { type: 'application/json' }),
    meta: {
      name: entry.name,
      ...(entry.issuerName ? { issuerName: entry.issuerName } : {}),
      ...(entry.issued ? { issued: entry.issued } : {}),
      ...(entry.validUntil ? { validUntil: entry.validUntil } : {}),
      currency: entry.currency,
      lineCount: entry.lineCount,
      pricedLineCount: entry.pricedLineCount,
      confidential: entry.confidential,
      bytes: entry.bytes,
      addedAt: entry.addedAt,
      tags: ['ratecard'],
    },
  });
  return entry;
}

/** Rebuild a row from a stored asset's meta (no parse). Null when it is not one of ours. */
function entryFromRef(ref: { id: string; type: string; meta?: Record<string, unknown> }): RateCardEntry | null {
  if (ref.type !== 'ratecard' || !ref.id.startsWith(USER_RATECARD_PREFIX)) return null;
  const digest = ref.id.slice(USER_RATECARD_PREFIX.length);
  const m = ref.meta ?? {};
  const entry: RateCardEntry = {
    digest,
    assetId: ref.id,
    name: String(m.name ?? digest),
    currency: String(m.currency ?? ''),
    lineCount: Number(m.lineCount ?? 0),
    pricedLineCount: Number(m.pricedLineCount ?? 0),
    confidential: m.confidential === true,
    bytes: Number(m.bytes ?? 0),
    addedAt: Number(m.addedAt ?? 0),
  };
  if (typeof m.issuerName === 'string' && m.issuerName.trim()) entry.issuerName = m.issuerName;
  if (typeof m.issued === 'string' && m.issued.trim()) entry.issued = m.issued;
  if (typeof m.validUntil === 'string' && m.validUntil.trim()) entry.validUntil = m.validUntil;
  return entry;
}

/** Every stored card, newest first. Best-effort: a hostile row is skipped, never thrown. */
export async function listRateCards(host: RateCardsHost): Promise<RateCardEntry[]> {
  const refs = await host.assets._listUserAssets().catch(() => []);
  return refs
    .map(entryFromRef)
    .filter((e): e is RateCardEntry => e !== null)
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** The slice a CATALOG rate-card listing needs - the tool-facing query/URL
 *  surface, not the user-asset store. Kept separate from RateCardsHost so each
 *  function states exactly what it touches. */
export interface CatalogRateCardsHost {
  assets: { query(filter: { type: 'ratecard' }): Promise<Array<{ id: string; url: string }>> };
}

/**
 * Catalog-shipped rate cards - the ORG distribution rail. A deployment (brand
 * pack, catalog channel, control-plane provider) ships a `type:'ratecard'`
 * catalog asset and it appears here, parsed so the entry states what the file
 * claims, with the SAME content digest a hand-dropped copy would get (so
 * money-policy's confidential/reveal semantics and the example-card refusal
 * hold identically, and holding the same card twice - dropped AND shipped - 
 * reads as one identity). Best-effort per card: an unreachable or invalid
 * catalog card is skipped, never thrown, and never priced.
 *
 * The bytes stay on the ordinary catalog rail (synced + checksummed by
 * catalog/sync.ts, offline via the IDB blob cache) - this module only reads.
 */
export async function listCatalogRateCards(host: CatalogRateCardsHost): Promise<RateCardEntry[]> {
  const refs = await host.assets.query({ type: 'ratecard' }).catch(() => []);
  const out: RateCardEntry[] = [];
  for (const ref of refs) {
    try {
      const resp = await fetch(ref.url);
      if (!resp.ok) continue;
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const digest = await digestOf(bytes);
      const card = parseRateCard(bytes, digest, validateRateCard);
      if (isRateCardError(card)) continue;
      const entry = entryFromCard(card, ref.id, bytes.byteLength);
      entry.assetId = ref.id;       // the catalog identity, not user/ratecards/…
      entry.catalogUrl = ref.url;   // where resolveCatalogRateCard re-reads it
      out.push(entry);
    } catch { /* unreachable/hostile card - skip */ }
  }
  return out;
}

/** Delete a stored card's bytes. */
export async function removeRateCard(host: RateCardsHost, digest: string): Promise<void> {
  await host.assets._deleteUserAsset(`${USER_RATECARD_PREFIX}${digest}`);
}

/** The stored bytes for a card, or null. */
export async function getRateCardBlob(host: RateCardsHost, digest: string): Promise<Blob | null> {
  return host.assets._getBlob(`${USER_RATECARD_PREFIX}${digest}`).catch(() => null);
}
