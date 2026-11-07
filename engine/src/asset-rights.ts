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

/** The one phrase for a mark its owner publishes, so a held list, credits and a details sheet agree. */
export const OWNER_PUBLISHED = 'Owner-published, not an open licence';

const OWNER_HOLDER_MAX = 256;
const OWNER_TERMS_MAX = 1024;

/** Who published their own work, and on what terms, in the words of the record. */
export interface OwnerPublishedV1 {
  holder: string;
  terms: string;
}

/**
 * Rule `owner-published-v1`: an owner may pass on their own work on their own terms.
 *
 * The record must say all of it, on the asset's own work: a licence declaration that is
 * not blank, a party with the role `owner`, and an asserted `own-work` grant whose `scope`
 * holds the terms. Anything less is not this record, so the bytes stay held back.
 *
 * This reads what a catalog states. It does not show that the party owns the work, and
 * it grants nobody anything beyond the terms the record carries.
 */
export function ownerPublished(value: unknown): OwnerPublishedV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const works = (value as { works?: unknown }).works;
  const work = Array.isArray(works) ? works[0] : value;
  if (!work || typeof work !== 'object' || Array.isArray(work)) return null;
  const { creators, rights, grants } = work as { creators?: unknown; rights?: unknown; grants?: unknown };
  if (!Array.isArray(creators) || !Array.isArray(rights) || !Array.isArray(grants)) return null;
  const declared = rights.slice(0, 16).some((row) => {
    const evidence = row as Partial<RightsEvidenceV1> | null;
    return !!evidence && typeof evidence.declaration === 'string' && !!evidence.declaration.trim() && evidence.status !== 'missing' && evidence.status !== 'not-applicable';
  });
  const owner = creators.slice(0, 64).find((party) => {
    const row = party as Partial<CreativePartyV1> | null;
    return !!row && row.role === 'owner' && typeof row.name === 'string' && !!row.name.trim();
  }) as CreativePartyV1 | undefined;
  const grant = grants.slice(0, 16).find((row) => {
    const entry = row as { kind?: unknown; scope?: unknown; asserted?: unknown } | null;
    return !!entry && entry.kind === 'own-work' && entry.asserted === true && typeof entry.scope === 'string' && !!entry.scope.trim();
  }) as { scope: string } | undefined;
  if (!declared || !owner || !grant) return null;
  return { holder: owner.name.trim().slice(0, OWNER_HOLDER_MAX), terms: grant.scope.trim().slice(0, OWNER_TERMS_MAX) };
}

/** Whether a record tried to be an own-work record and left something out. */
function claimsOwnWork(value: unknown): boolean {
  const works = value && typeof value === 'object' ? (value as { works?: unknown }).works : null;
  const work = Array.isArray(works) ? works[0] : value;
  const grants = work && typeof work === 'object' ? (work as { grants?: unknown }).grants : null;
  return Array.isArray(grants) && grants.slice(0, 16).some((grant) => !!grant && (grant as { kind?: unknown }).kind === 'own-work');
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
  /** Present when the bytes travel under `owner-published-v1`. `kind` stays `licence`, because it only sorts what holds bytes back. */
  owner?: OwnerPublishedV1;
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
  // A reviewed licence answers for itself. The owner's own record speaks only where no reviewed rule does.
  if (!profile?.reviewed) {
    const owner = ownerPublished(meta.rights);
    if (owner) {
      return { travels: true, kind: 'licence', reason: '', licence: OWNER_PUBLISHED, notices: notices.includes(owner.terms) ? notices : [...notices, owner.terms], owner };
    }
    if (claimsOwnWork(meta.rights)) {
      return { travels: false, kind: 'unknown', reason: 'the own-work record is missing its owner, its terms or its licence declaration', licence, notices };
    }
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

// The `.lolly` credits text, moved down from the web shell so a Lolly Work ZIP and a
// `.lolly` pack print one text from one function.

/** One catalog work whose bytes travelled inside the pack. */
export interface PackCreditEntry {
  label: string;
  id: string;
  path: string;
  licence?: string;
  credit?: string;
  notices?: string[];
  /** True when the sender chose to include bytes that were held back by default. */
  includedByChoice?: true;
}

/** One catalog work whose bytes did NOT travel, and the reason. */
export interface PackHoldEntry {
  label: string;
  id: string;
  reason: string;
  /**
   * Whether a deployment rule or a licence condition held the bytes back.
   * Printed as its own line, because a catalog lock read as a licence condition
   * would misrepresent a brand policy as an extra copyright term on open
   * material (plan 253 section 11).
   */
  kind?: 'policy' | 'licence' | 'unknown';
  licence?: string;
}

/** How each kind of hold reads in a credits file. */
const HOLD_KIND: Record<'policy' | 'licence' | 'unknown', string> = {
  policy: 'deployment policy',
  licence: 'licence condition',
  unknown: 'nothing recorded about passing these bytes on',
};

/**
 * The pack's readable credits: every catalog work whose bytes travelled, with its
 * licence, credit and any notice the licence asks to travel, then every work that
 * was held back with the reason it was.
 *
 * It is a record, not a clearance. It says what this file carries and what it does
 * not; it does not say a use is permitted, and a work with no licence recorded
 * reads exactly that way. Returns '' when no catalog work was involved at all.
 */
export function packCreditsText(carried: readonly PackCreditEntry[], heldBack: readonly PackHoldEntry[]): string {
  if (!carried.length && !heldBack.length) return '';
  const lines: string[] = ['Credits for the catalog works in this file.', ''];
  if (carried.length) {
    lines.push(`Travelled with this file (${carried.length}):`, '');
    for (const entry of carried) {
      lines.push(`- ${entry.label} (${entry.id})`);
      lines.push(`  file:    ${entry.path}`);
      lines.push(`  licence: ${entry.licence || 'not recorded'}`);
      if (entry.credit) lines.push(`  credit:  ${entry.credit}`);
      if (entry.includedByChoice) lines.push('  included by the sender, who chose to carry bytes held back by default');
      for (const notice of entry.notices ?? []) lines.push(`  notice:  ${notice}`);
      lines.push('');
    }
  }
  if (heldBack.length) {
    lines.push(`Held back (${heldBack.length}) - referenced, but the bytes are not in this file:`, '');
    for (const entry of heldBack) {
      lines.push(`- ${entry.label} (${entry.id})`);
      lines.push(`  licence: ${entry.licence || 'not recorded'}`);
      lines.push(`  held by: ${HOLD_KIND[entry.kind ?? 'unknown']}`);
      lines.push(`  reason:  ${entry.reason}`);
      lines.push('');
    }
    lines.push('Open the file on a device that already has these works, or ask the sender.', '');
  }
  lines.push('Keep this file with the design when you pass it on.');
  return lines.join('\n');
}
