// SPDX-License-Identifier: MPL-2.0
/**
 * The mark handoff stash (plan 97 section 8, M5) - how logos extracted somewhere else
 * (the `#/pdf` exploder's "Send to the Design System studio") reach the Logos
 * room across one navigation.
 *
 * This is the `takePendingToolFile` pattern from `lib/drop-router.ts`, kept to
 * the letter: a module-level one-shot stash, cleared on read, that survives
 * exactly one navigation and never touches disk. Nothing here persists, so a
 * reload loses the handoff - which is the honest behaviour: the marks were
 * extracted from a file the studio no longer holds, and a stale queue of
 * mystery chips a week later would be worse than an empty room.
 *
 * The sender stashes; the Logos room drains ONCE per mount and queues what it
 * finds as ordinary confirm chips. It is deliberately not an install path - a
 * mark that arrives from a PDF is classified and confirmed exactly like a mark
 * the user dropped by hand, so nothing lands in a slot without a tap.
 *
 * The caps mirror the room's own: {@link PENDING_LOGO_MAX_FILES} marks, each at
 * most {@link PENDING_LOGO_MAX_BYTES} (the limit `installLogo` enforces anyway).
 * Over-cap files are dropped here, at the send, rather than travelling to a room
 * that would only refuse them - and the drop is REPORTED BACK (as well as
 * warned), because the caller is the one that promised a count and is the only
 * one that can correct it. A send that arms nothing must not read as a success.
 */

/** The most marks one handoff may carry. Chosen under the room's own intake
 *  ceiling (12) so an arriving batch cannot fill the queue by itself. */
export const PENDING_LOGO_MAX_FILES = 8;
/** Per-file byte cap - the same 4 MB `installLogo` refuses above. */
export const PENDING_LOGO_MAX_BYTES = 4 * 1024 * 1024;

/**
 * What one send actually armed, so a caller can say the true number rather than
 * the number it offered. `sent === 0` is the case that matters: the button said
 * "review 3 marks in Logos" and there is now nothing to review, so navigating
 * and playing the success sound would be a lie the empty room then has to carry.
 */
export interface PendingLogoSend {
  /** Marks armed for the next Logos mount. */
  sent: number;
  /** Dropped for being over {@link PENDING_LOGO_MAX_BYTES}. */
  tooBig: number;
  /** Dropped because the batch was over {@link PENDING_LOGO_MAX_FILES}. */
  overflow: number;
}

let pendingLogos: File[] = [];

/**
 * Arm the handoff with the marks to hand the Logos room on its next mount.
 *
 * A second send REPLACES the first: the stash is a message in flight, not a
 * queue, and two sends without a mount in between mean the user changed their
 * mind about what to send. Files over either cap are dropped (warned and
 * counted, never thrown) so a mis-sized mark can never block the rest of a batch.
 */
export function stashPendingLogoFiles(files: File[]): PendingLogoSend {
  const sized = files.filter((f) => {
    if (f.size <= PENDING_LOGO_MAX_BYTES) return true;
    console.warn(`[design-system] "${f.name}" is over the 4 MB mark limit - not sent`);
    return false;
  });
  if (sized.length > PENDING_LOGO_MAX_FILES) {
    console.warn(
      `[design-system] ${sized.length} marks sent, only the first ${PENDING_LOGO_MAX_FILES} are kept`,
    );
  }
  pendingLogos = sized.slice(0, PENDING_LOGO_MAX_FILES);
  return {
    sent: pendingLogos.length,
    tooBig: files.length - sized.length,
    overflow: sized.length - pendingLogos.length,
  };
}

/** Consume the stash. Single use - the second call returns nothing, which is
 *  what keeps a room re-paint from queueing the same marks twice. */
export function takePendingLogoFiles(): File[] {
  const files = pendingLogos;
  pendingLogos = [];
  return files;
}

/** Whether a handoff is waiting. Read-only: it never empties the stash, so a
 *  caller can decide to announce before it decides to drain. */
export function hasPendingLogoFiles(): boolean {
  return pendingLogos.length > 0;
}
