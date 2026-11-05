// SPDX-License-Identifier: MPL-2.0
/**
 * One reader for the rights an asset carries, and the one answer to "may these bytes
 * be passed on?" (plan 253). Moved down from the web shell so a `.lolly` pack, a brand
 * skill folder and a brand page all get the same answer and the same reason.
 *
 * Pure: no DOM, no storage, no network. Every field is untrusted input.
 */
import type { CreativePartyV1, CreativeWorkRecordV1, RightsEvidenceV1 } from '@lolly-tools/core/rights-v1';
import { licenceProfile, normaliseLicence } from './rights-profiles.ts';

/** The rights-bearing keys an asset ref's `meta` may carry, all optional and all untrusted. */
export interface AssetRightsMeta {
  license?: unknown;
  attribution?: unknown;
  rights?: unknown;
}

const SOURCE_HASH = /^sha256:[0-9a-f]{64}$/;

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
    // The two fields a derived file needs to bind the source's exact bytes,
    // kept only in the shape the credential writer accepts.
    ...(typeof record.revision === 'string' && record.revision.length <= 256 ? { revision: record.revision } : {}),
    ...(typeof record.sourceHash === 'string' && SOURCE_HASH.test(record.sourceHash) ? { sourceHash: record.sourceHash } : {}),
    rights,
  };
}

/**
 * The licence declaration one asset carries. The legacy `license`
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

/**
 * Notice texts an asset's rights record asks to travel with its bytes, read
 * defensively and bounded.
 *
 * Deliberately more forgiving than {@link readAssetRightsRecord}: a notice is a
 * string to print beside the bytes, so a record missing an id or a creator still
 * yields its notices.
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

/** Whether an asset's own bytes may travel, and why not. */
export interface Redistribution {
  travels: boolean;
  /** Why the bytes were held back, in plain words. Empty when they travel. */
  reason: string;
  /**
   * Which KIND of rule held them back. A deployment's own catalog lock and a
   * licence condition are different things, and a credits file that printed
   * both in one column would read a brand policy as an extra copyright term on
   * open material (plan 253 section 11). `unknown` is the third answer: nothing
   * was recorded, which is neither.
   */
  kind: 'policy' | 'licence' | 'unknown';
  /** The canonical licence name, or '' when nothing was recorded. */
  licence: string;
  /** Notice texts the licence asks to travel with the bytes. */
  notices: string[];
}

/**
 * May these bytes be passed on? Answered from the reviewed licence profiles
 * (plan 253), not from a regular expression over the label.
 *
 * BEHAVIOUR CHANGE: unmarked catalog bytes no longer travel by default. The old
 * test matched `proprietary|all-rights-reserved|licenseref|premiumbeat` and let
 * everything else through, so an asset with NO licence recorded was treated as
 * freely redistributable. Missing licence information is not evidence of free
 * redistribution, so an unrecorded or not-yet-interpreted licence is now held
 * back with its reason. A `LicenseRef-*` is no longer proprietary by spelling
 * either; it is an identifier these rules do not carry, which is a different
 * sentence with the same outcome. `includeLicensed` still carries held-back
 * bytes when the sender says so, and the pack's credits file lists the choice.
 */
export function redistribution(meta: Record<string, unknown>): Redistribution {
  // One reader for the licence, shared with the catalog details sheet, so an
  // asset that records its licence only in the structured record cannot be held
  // back here as unrecorded while its own sheet shows a licence.
  const declared = assetLicenceDeclaration(meta as AssetRightsMeta);
  const normalised = declared ? normaliseLicence(declared) : null;
  const profile = normalised?.id ? licenceProfile(normalised.id) : null;
  const licence = profile?.name ?? normalised?.id ?? '';
  const notices = assetRightsNotices(meta.rights);
  if (meta.brandLock === true) {
    return { travels: false, kind: 'policy', reason: 'this brand pack is authoritative on this device', licence, notices };
  }
  if (!declared) return { travels: false, kind: 'unknown', reason: 'licence not recorded', licence, notices };
  if (!profile?.reviewed) {
    return {
      travels: false,
      kind: 'unknown',
      reason: normalised?.id ? `${normalised.id} is recorded and not yet interpreted` : `${declared} was not recognised`,
      licence,
      notices,
    };
  }
  if (profile.redistributeSource !== 'permitted-with-notices') {
    return { travels: false, kind: 'licence', reason: `${profile.name} does not record permission to pass on the source file`, licence, notices };
  }
  return { travels: true, kind: 'licence', reason: '', licence, notices };
}
