// SPDX-License-Identifier: MPL-2.0
/** One reader for the rights a catalog or user asset carries, shared by every surface that asks (plan 253). */
import { licenceProfile, normaliseLicence, type LicenceProfileV1 } from '../../../../engine/src/rights-profiles.ts';
import { assetLicenceDeclaration, type AssetRightsMeta } from '../../../../engine/src/asset-rights.ts';

// The readers moved to the engine so every shell gets the same answer.
export { assetLicenceDeclaration, assetRightsNotices, readAssetRightsRecord } from '../../../../engine/src/asset-rights.ts';
export type { AssetRightsMeta } from '../../../../engine/src/asset-rights.ts';

/** An asset's licence as words, in a short and a long form, from {@link licenceLabel}. */
export interface LicenceLabel {
  /**
   * For a narrow cell: the shorter of the licence's own name and its
   * identifier, the name on a tie ("CC BY 4.0", "CC0 1.0", "CC-PDDC", "MIT").
   * An unrecognised declaration is used as it is.
   */
  short: string;
  /**
   * The name the details sheet prints: the profile's name, else the identifier
   * followed by its version, else the declaration. The version is appended even
   * where the identifier already holds it ("CC-BY-3.0 3.0"), as the sheet always did.
   */
  full: string;
  /** The declaration exactly as recorded on the asset. */
  declared: string;
  /** The reviewed rules for the licence, or null when this build has none for this licence. */
  profile: LicenceProfileV1 | null;
}

/**
 * The words for an asset's licence, or null when none is recorded. One reading
 * for the details sheet and the Assets list, so the two never name the same
 * licence differently. Recorded is not the same as reviewed: a declaration this
 * build cannot interpret still gets a label (its own text), and `profile` is
 * null, which callers state as "not yet interpreted" rather than as a problem.
 */
export function licenceLabel(meta: AssetRightsMeta | undefined): LicenceLabel | null {
  const declared = assetLicenceDeclaration(meta);
  if (!declared) return null;
  const normalised = normaliseLicence(declared);
  if (!normalised.id) return { short: declared, full: declared, declared, profile: null };
  const profile = licenceProfile(normalised.id);
  const full = `${profile?.name ?? normalised.id}${!profile?.name && normalised.version ? ` ${normalised.version}` : ''}`;
  return { short: full.length <= normalised.id.length ? full : normalised.id, full, declared, profile };
}
