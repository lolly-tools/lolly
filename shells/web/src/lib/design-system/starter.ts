// SPDX-License-Identifier: MPL-2.0
/**
 * starter.ts - the blank document a new design system starts from.
 *
 * "Make a new one" makes a new brand, not a copy of whichever brand this build
 * ships; copying is "Make an editable copy". Seeding from the shipped head only
 * looked right on lolly-start, where the shipped system IS the blank starter.
 * On lolly-demo or SUSE it handed people a duplicate of the loaded brand.
 *
 * The starter is brands/lolly-start's tokens asset. A catalog that ships it
 * answers first, so lolly-start reads the same bytes it always did; every other
 * build reads the copy bundled from that pack. The bundled copy's logo slots
 * point at lolly/logo/* catalog assets, which a SUSE or ingested catalog does
 * not carry, so a seed drops each slot this catalog cannot serve and the studio
 * shows that slot empty rather than broken.
 */
import bundledStarter from '../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json' with { type: 'json' };

/** The starter catalog's placeholder tokens asset (brands/lolly-start). Matching
 *  it is the shell's existing "unbranded" test - views/gallery.ts gates the
 *  first-run welcome on the same id - and it is the one tokens asset that means
 *  nothing has been furnished yet. Exported because the Overview and Colours
 *  rooms need the same asset for the same reason (a starter swatch nobody
 *  chose), and two copies of a well-known id is how they drift apart. */
export const STARTER_TOKENS_ID = 'lolly/tokens/brand';

/** The slice of the assets bridge the starter reads through. */
export interface StarterHost {
  assets: {
    _getBlob?(id: string): Promise<Blob | null>;
    /** The synced catalog's asset ids: what this build can serve. */
    _listCatalogAssetIds?(): Promise<string[]>;
  };
}

type Doc = Record<string, unknown>;

function isDoc(value: unknown): value is Doc {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The starter document, and whether it is the bundled copy. Never throws. */
export async function readStarterTokens(host: StarterHost): Promise<{ doc: Doc; bundled: boolean }> {
  try {
    const blob = await host.assets._getBlob?.(STARTER_TOKENS_ID);
    if (blob) {
      const doc: unknown = JSON.parse(await blob.text());
      if (isDoc(doc)) return { doc, bundled: false };
    }
  } catch { /* absent or unreadable: the bundled copy stands in */ }
  return { doc: structuredClone(bundledStarter) as Doc, bundled: true };
}

/** What a new design system's head starts as. */
export async function starterSeed(host: StarterHost): Promise<Doc> {
  const { doc, bundled } = await readStarterTokens(host);
  if (bundled) await dropUnservedLogos(host, doc);
  return doc;
}

/** Remove each logo slot whose asset the synced catalog does not hold. With no
 *  catalog list to read (nothing synced yet) every slot stays, because a slot
 *  is only dropped on evidence. */
async function dropUnservedLogos(host: StarterHost, doc: Doc): Promise<void> {
  const base = doc.base;
  const asset = isDoc(base) ? base.asset : undefined;
  const logos = isDoc(asset) ? asset.logo : undefined;
  if (!isDoc(logos)) return;
  let catalog: Set<string>;
  try { catalog = new Set(await host.assets._listCatalogAssetIds?.() ?? []); }
  catch { return; }
  if (!catalog.size) return;
  for (const [slot, token] of Object.entries(logos)) {
    if (isDoc(token) && typeof token.$value === 'string' && !catalog.has(token.$value)) delete logos[slot];
  }
}
