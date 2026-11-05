// SPDX-License-Identifier: MPL-2.0
import { redistribution } from '../../../../engine/src/asset-rights.ts';
import type { LollyLibraryAsset } from './lolly-pack.ts';

// The rule moved to the engine so a brand skill folder and a brand page get the same answer.
export { redistribution } from '../../../../engine/src/asset-rights.ts';
export type { Redistribution } from '../../../../engine/src/asset-rights.ts';

/** The rights fields a `.lolly` builder reads off one catalog asset. */
export type PackRights = Pick<LollyLibraryAsset, 'licensed' | 'holdReason' | 'holdKind' | 'licence' | 'credit' | 'notices'>;

/**
 * The `redistribution()` answer in the shape `buildLollyFile` reads: held back or
 * not, the reason and its kind, and the licence, credit and notices the pack's
 * CREDITS.txt prints. Every path that resolves catalog bytes for a `.lolly` (a
 * session share, a Projects download, a template share, a brand pack) spreads
 * this, so the same asset gets the same answer and the same reason on each.
 */
export function packRights(meta: Record<string, unknown>): PackRights {
  const permission = redistribution(meta);
  return {
    licensed: !permission.travels,
    ...(permission.reason ? { holdReason: permission.reason, holdKind: permission.kind } : {}),
    ...(permission.licence ? { licence: permission.licence } : {}),
    ...(permission.notices.length ? { notices: permission.notices } : {}),
    ...(typeof meta.attribution === 'string' && meta.attribution.trim() ? { credit: meta.attribution.trim() } : {}),
  };
}
