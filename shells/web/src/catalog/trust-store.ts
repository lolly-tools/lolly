// SPDX-License-Identifier: MPL-2.0
/** Atomic catalog acceptance in the existing device-local profile store. */
import { openDB } from '../bridge/db.ts';
import { catalogFreshness } from '../../../../engine/src/catalog-integrity.ts';
import type { AcceptedCatalog, CatalogSnapshot } from './snapshot.ts';

const key = (origin: string, scope: string): string => `catalog-trust-v1:${origin}:${scope}`;
const latestKey = (origin: string): string => `catalog-trust-latest-v1:${origin}`;
export async function readAcceptedCatalog(origin: string, scope: string): Promise<AcceptedCatalog | null> {
  const db = await openDB();
  return (await db.get('profile', key(origin, scope)) as AcceptedCatalog | undefined) ?? null;
}

/** The last accepted visibility scope supplies only a revalidation hint or offline copy. */
export async function readLatestAcceptedCatalog(origin: string): Promise<AcceptedCatalog | null> {
  const db = await openDB();
  const scope = await db.get('profile', latestKey(origin)) as string | undefined;
  return scope ? readAcceptedCatalog(origin, scope) : null;
}

/** Concurrent tabs compare against the latest committed floor in the same transaction. */
export async function acceptCatalogSnapshot(origin: string, scope: string, snapshot: CatalogSnapshot): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('profile', 'readwrite');
  try {
    const previous = await transaction.store.get(key(origin, scope)) as AcceptedCatalog | undefined;
    const fresh = catalogFreshness(snapshot.envelope, previous?.watermark ?? null);
    if (!fresh.ok) throw new Error(`Catalog refused: ${fresh.reason}`);
    const watermark = { signedAt: snapshot.envelope.signedAt, ...(snapshot.envelope.seq !== undefined ? { seq: snapshot.envelope.seq } : {}) };
    await transaction.store.put({ watermark, snapshot } satisfies AcceptedCatalog, key(origin, scope));
    await transaction.store.put(scope, latestKey(origin));
    await transaction.done;
  } catch (error) {
    try { transaction.abort(); } catch { /* The transaction may already be closed. */ }
    await transaction.done.catch(() => {});
    throw error;
  }
}
