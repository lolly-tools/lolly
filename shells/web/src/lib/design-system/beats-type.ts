// SPDX-License-Identifier: MPL-2.0
/**
 * beats-type.ts - which beat the Type room is showing (plan 182 section 3a).
 *
 * A room grows with the system rather than presenting all of itself at once. The
 * Type room has two beats:
 *
 *   0  nothing of its own. One card - Primary - with the starter face it is
 *      wearing and one action. No fonts list, no specimen, and the other three
 *      roles behind "Choose them separately".
 *   1  a face of the person's own exists. The four cards, the Fonts panel and
 *      the Type roles specimen.
 *
 * WHY A MODULE. The beat is a pure function of the ownership report, so the room
 * can re-ask it after every repaint without keeping a flag that can go stale,
 * and the answer is testable without a DOM.
 *
 * WHY THIS FILENAME. `beats.ts` is being written alongside this by the Colours
 * milestone and will hold every room's beat; this file is the Type room's half,
 * ready to move into it as a one-line re-export. Nothing but the Type room reads
 * it.
 */

import { FONT_ROLES } from './ownership.ts';
import type { OwnershipReport } from './ownership.ts';

/** 0 = the room's first decision, 1 = the room. Type has no beat 2 (no expert
 *  wing), which is why this is not a wider union. */
export type TypeBeat = 0 | 1;

/**
 * The Type room's beat.
 *
 * `installedFaces` is the count of families installed on this device, and it is
 * not the same question as "does a role hold an own face": a face can be
 * installed and hold no role (the Fonts panel's "Add a face" on a brand-locked
 * profile, or a role cleared after an install). Beat 0 hides the fonts list, so
 * a room that answered 0 while a face was installed would hide the only surface
 * that can manage it. Either signal is enough to be past the first decision.
 */
export function typeBeat(report: OwnershipReport, installedFaces = 0): TypeBeat {
  if (installedFaces > 0) return 1;
  const own = FONT_ROLES.some((role) => report.faces[role]?.state === 'own');
  return own ? 1 : 0;
}
