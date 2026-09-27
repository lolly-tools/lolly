// SPDX-License-Identifier: MPL-2.0
/**
 * Canonical namespace prefix for batch-run "slots" persisted in host.state.
 * This literal + predicate were copy-pasted across pro/sessions, gallery,
 * profile, folder-tiles and folder-rows (finding #13). This leaf module (no
 * other imports, so it can't create an import cycle) is now the single source;
 * the others import or re-export it.
 */
export const BATCH_SLOT_PREFIX = '__batch__:';

export const isBatchSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(BATCH_SLOT_PREFIX);

/**
 * Trash namespace (plans/133 WP-4): a deleted session's state record is MOVED
 * to `__trash__:<original slot>` instead of being removed, so it can be
 * restored. Every surface that lists sessions for the user (projects, gallery,
 * picker, /pro sessions, spotlight, folder overlay) must filter these out;
 * backup/export and slot-collision checks deliberately keep seeing them.
 */
export const TRASH_SLOT_PREFIX = '__trash__:';

export const isTrashedSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(TRASH_SLOT_PREFIX);

/**
 * Project-template namespace (plans/133 WP-11a): a saved folder template keeps a
 * COPY of each member session's record at `__ptpl__:<template id>:<original slot>`.
 * Hidden from every session-listing surface exactly like the trash; instantiating
 * a template copies these back out under fresh slots.
 */
export const PTPL_SLOT_PREFIX = '__ptpl__:';

export const isTemplateSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(PTPL_SLOT_PREFIX);

/**
 * Remembered-export-shape namespace (plans/163 L3): the last format/size a tool was
 * downloaded as, at `__xprefs__:<tool id>`. A shell preference, not saved work, so it
 * is hidden from every session list exactly like the trash - one per tool the user has
 * ever exported from would otherwise fill Projects with untitled tiles.
 */
export const XPREFS_SLOT_PREFIX = '__xprefs__:';

export const isExportPrefsSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(XPREFS_SLOT_PREFIX);

/** Internal design-system records include the import checkpoint ring. */
export const isDesignSystemSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith('design-system.');

/** A slot no user-facing session list should show. */
/** A renovation project or one of its parts (plan 274 section 3.5), kept under
 *  `__rebrand__:` by lib/rebrand/project-store.ts. Never a saved tool session. */
export const REBRAND_SLOT_PREFIX = '__rebrand__:';
export const isRebrandSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(REBRAND_SLOT_PREFIX);

/**
 * Discarded namespace (plan 277 P1): Leave without saving moves a creation that
 * was never explicitly saved to `__discarded__:<time>:<original slot>`, with its
 * history, instead of leaving it in Projects. Hidden from every session list like
 * the trash, but this is not the trash and has no Restore. Its automatic
 * checkpoints stay in History, where a copy can be opened, until a later discard
 * clears entries older than DISCARD_RETENTION_MS.
 */
export const DISCARDED_SLOT_PREFIX = '__discarded__:';
export const DISCARD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const isDiscardedSlot = (slot: unknown): boolean =>
  typeof slot === 'string' && slot.startsWith(DISCARDED_SLOT_PREFIX);

/** The hidden slot a discarded creation moves to, stamped with the discard time. */
export const discardedSlot = (slot: string, at: number): string =>
  `${DISCARDED_SLOT_PREFIX}${Math.max(0, Math.floor(at)).toString(36)}:${slot}`;

/** When a discarded slot was discarded (ms since the epoch), or null for any other slot. */
export function discardedAt(slot: string): number | null {
  if (!isDiscardedSlot(slot)) return null;
  const stamp = slot.slice(DISCARDED_SLOT_PREFIX.length).split(':', 1)[0] ?? '';
  const at = /^[0-9a-z]+$/.test(stamp) ? parseInt(stamp, 36) : NaN;
  return Number.isSafeInteger(at) ? at : null;
}

export const isHiddenSlot = (slot: unknown): boolean =>
  isTrashedSlot(slot) || isTemplateSlot(slot) || isExportPrefsSlot(slot) || isDesignSystemSlot(slot) || isRebrandSlot(slot)
  || isDiscardedSlot(slot);
