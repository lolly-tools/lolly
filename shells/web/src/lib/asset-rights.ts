// SPDX-License-Identifier: MPL-2.0
/** One reader for the rights a catalog or user asset carries, shared by every surface that asks (plan 253). */
import type { CreativePartyV1, CreativeWorkRecordV1, RightsEvidenceV1 } from '@lolly-tools/core/rights-v1';
import { licenceProfile, normaliseLicence, type LicenceProfileV1 } from '../../../../engine/src/rights-profiles.ts';

/** The rights-bearing keys an asset ref's `meta` may carry, all optional and all untrusted. */
export interface AssetRightsMeta {
  license?: unknown;
  attribution?: unknown;
  rights?: unknown;
}

/**
 * The narrowest honest read of an asset's `rights` record: shapes only, nothing
 * coerced, everything bounded. A record arrives from a catalog index, a pack
 * manifest or a file somebody opened, so this reader treats all three as data it
 * was handed.
 *
 * Two shapes are accepted. `schemas/asset.schema.json` declares the catalog one
 * as `{ works: [...] }`, which is what the shipped emoji packs carry, and the
 * first work is the asset's own. A bare work record is also read, for a store
 * that saved one that way.
 */
export function readAssetRightsRecord(value: unknown): CreativeWorkRecordV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const works = (value as { works?: unknown }).works;
  if (Array.isArray(works)) return works.length ? readAssetRightsRecord(works[0]) : null;
  const record = value as Partial<CreativeWorkRecordV1>;
  if (typeof record.id !== 'string') return null;
  const creators = Array.isArray(record.creators)
    ? record.creators.filter((party): party is CreativePartyV1 => !!party && typeof party === 'object' && typeof (party as CreativePartyV1).name === 'string').slice(0, 32)
    : [];
  const rights = Array.isArray(record.rights)
    ? record.rights.filter((evidence): evidence is RightsEvidenceV1 => !!evidence && typeof evidence === 'object' && typeof (evidence as RightsEvidenceV1).declaration === 'string').slice(0, 16)
    : [];
  return {
    id: record.id,
    ...(typeof record.title === 'string' ? { title: record.title } : {}),
    creators,
    ...(typeof record.sourceUrl === 'string' ? { sourceUrl: record.sourceUrl } : {}),
    rights,
  };
}

/**
 * The licence declaration one asset carries, in one place. The legacy `license`
 * string wins where it exists, and the structured record answers where it does
 * not, so the details sheet and the `.lolly` redistribution gate can never
 * disagree about whether an asset's licence was recorded at all. An evidence
 * record whose status says the field was looked for and found empty is not a
 * declaration, so it is skipped here as it is in the engine.
 */
export function assetLicenceDeclaration(meta: AssetRightsMeta | undefined): string {
  const legacy = typeof meta?.license === 'string' ? meta.license.trim() : '';
  if (legacy) return legacy;
  const record = readAssetRightsRecord(meta?.rights);
  const found = record?.rights.find((evidence) => evidence.status !== 'missing' && evidence.status !== 'not-applicable' && evidence.declaration.trim());
  return found?.declaration.trim() ?? '';
}

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

/**
 * Notice texts an asset's rights record asks to travel with its bytes, read
 * defensively and bounded.
 *
 * Deliberately more forgiving than {@link readAssetRightsRecord}: a notice is a
 * string to print beside the bytes, so a record missing an id or a creator still
 * gives up the notice it carries rather than losing it to a shape check.
 */
export function assetRightsNotices(value: unknown): string[] {
  const out: string[] = [];
  for (const evidence of evidenceArrayOf(value)) {
    const notices = (evidence as { notices?: unknown }).notices;
    if (!Array.isArray(notices)) continue;
    for (const notice of notices.slice(0, 8)) if (typeof notice === 'string' && notice.trim()) out.push(notice.trim());
  }
  return out;
}

/** Every evidence entry in a rights record, from either shape, bounded. */
function evidenceArrayOf(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const works = (value as { works?: unknown }).works;
  if (Array.isArray(works)) return works.slice(0, 64).flatMap((work) => evidenceArrayOf(work));
  const rights = (value as { rights?: unknown }).rights;
  return Array.isArray(rights) ? rights.slice(0, 16) : [];
}
