// SPDX-License-Identifier: MPL-2.0
import { redistribution } from '../../../../engine/src/asset-rights.ts';
import type { LollyLibraryAsset } from './lolly-pack.ts';

// The rule moved to the engine so a brand skill folder and a brand page get the same answer.
export { redistribution } from '../../../../engine/src/asset-rights.ts';
export type { Redistribution } from '../../../../engine/src/asset-rights.ts';

/** The rights fields a `.lolly` builder reads off one catalog asset. */
export type PackRights = Pick<LollyLibraryAsset, 'licensed' | 'holdReason' | 'holdKind' | 'licence' | 'credit' | 'notices' | 'unrecorded'>;

/**
 * The `redistribution()` answer in the shape `buildLollyFile` reads: held back or
 * not, the reason and its kind, and the licence, credit and notices the pack's
 * CREDITS.txt prints. Every path that resolves catalog bytes for a `.lolly` (a
 * session share, a Projects download, a template share, a brand pack) spreads
 * this, so the same asset gets the same answer and the same reason on each.
 *
 * A work with no licence recorded at all travels, with a warning instead of a hold
 * (Andy, 2026-11-12: "lets not hold back catalog files with an unrecorded license if
 * the user wants to download them, we can warn not stop", for every `.lolly` path).
 * The reason goes with the bytes as `unrecorded`: the sender is told which works
 * those are, and CREDITS.txt asks whoever opens the file to check the terms. A
 * recorded licence that is not yet interpreted (a house LicenseRef, NC or ND) still
 * holds, with the sender's include choice as before, because its terms exist and may
 * forbid passing the file on; so do a brand lock and a reviewed licence that does not
 * permit passing the file on. Brand pages and brand skill folders, which publish rather than hand a
 * file to someone, read `redistribution()` itself and keep holding all of these back.
 */
export function packRights(meta: Record<string, unknown>): PackRights {
  const permission = redistribution(meta);
  const credit = typeof meta.attribution === 'string' && meta.attribution.trim() ? { credit: meta.attribution.trim() } : {};
  if (!permission.travels && permission.unrecorded) {
    return {
      unrecorded: permission.reason || 'licence not recorded',
      ...(permission.licence ? { licence: permission.licence } : {}),
      ...(permission.notices.length ? { notices: permission.notices } : {}),
      ...credit,
    };
  }
  return {
    licensed: !permission.travels,
    ...(permission.reason ? { holdReason: permission.reason, holdKind: permission.kind } : {}),
    ...(permission.licence ? { licence: permission.licence } : {}),
    ...(permission.notices.length ? { notices: permission.notices } : {}),
    ...credit,
  };
}
