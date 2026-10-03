// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog access: a refused catalog read means "signed out", never "offline".
 *
 * A deployment can keep its catalog for signed-in people only. To a visitor with
 * no session it answers 401 or 403 while the network is fine, so catalog code
 * reads that answer here instead of taking its offline path: no retry, no
 * offline chip, and no further catalog reads for this instance base on this page
 * load (signing in reloads the page). The control-plane seam (org/) reports its
 * own sign-in gate through {@link noteCatalogRefused} too, so a gated instance
 * stops catalog work even where the catalog itself would have answered.
 *
 * A refusal is also remembered per instance base, so the next boot can ask the
 * deployment about sign-in before it requests the catalog at all
 * (catalog/sync.ts). The first catalog read that succeeds forgets the refusal.
 *
 * Dormant by construction: a deployment that never refuses never writes the key,
 * and every function here is then a flag check or one localStorage read.
 */
import { getInstanceBase } from './instance.ts';

// index.html's slim-index warm script reads the same-origin key by name
// (pinned by boot-warm-fetch.test.ts), so a change of spelling goes there too.
const refusedKey = (base: string): string => `lolly:catalog-refused:${base || 'same-origin'}`;

/** The instance base whose catalog refused this visitor on this page load. */
let refusedBase: string | null = null;

/** True for the two answers that mean "not without signing in". */
export function isAccessRefused(status: number): boolean {
  return status === 401 || status === 403;
}

/** A catalog request the instance refused (401/403). Catalog code treats it as
 *  "signed out": it neither retries it nor reports the network as offline. */
export class CatalogRefusedError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} fetching ${url} (sign-in needed)`);
    this.name = 'CatalogRefusedError';
    this.status = status;
  }
}

/** Whether this page load already learned that the current instance refuses its
 *  catalog to this visitor. Keyed by base, so switching instance starts clean. */
export function catalogRefused(): boolean {
  return refusedBase !== null && refusedBase === getInstanceBase();
}

/** Record that the current instance refused its catalog (an HTTP 401/403, or a
 *  sign-in gate). Stops catalog reads for this page load and is remembered. */
export function noteCatalogRefused(): void {
  const base = getInstanceBase();
  refusedBase = base;
  try { localStorage.setItem(refusedKey(base), '1'); } catch { /* storage off: this page load only */ }
}

/** A catalog read succeeded: forget any refusal recorded for the current base. */
export function noteCatalogAllowed(): void {
  const base = getInstanceBase();
  if (refusedBase === base) refusedBase = null;
  try {
    if (localStorage.getItem(refusedKey(base)) !== null) localStorage.removeItem(refusedKey(base));
  } catch { /* storage off */ }
}

/** Whether the current instance refused its catalog on an earlier page load. */
export function catalogRefusedBefore(): boolean {
  try { return localStorage.getItem(refusedKey(getInstanceBase())) !== null; } catch { return false; }
}

/** Test seam: forget this page load's refusal (the remembered key is left alone). */
export function resetCatalogAccessForTests(): void {
  refusedBase = null;
}
