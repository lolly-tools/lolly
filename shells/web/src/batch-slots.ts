// SPDX-License-Identifier: MPL-2.0
/**
 * Canonical batch-slot naming — the ONE home for the `__batch__:` namespace.
 *
 * Pro/Batch sessions are persisted through the same host state bridge as
 * single-tool sessions; their slots are namespaced with BATCH_SLOT_PREFIX so
 * the rest of the app can tell them apart (regular slots are
 * `<toolId>:<timestamp>`, which never collide with this prefix).
 *
 * Lives outside pro/ on purpose: gallery, folder tiles and the profile view
 * must classify slots without importing from the removable /pro folder.
 */

/** Distinctive slot prefix for saved batch sessions. Persisted — never change. */
export const BATCH_SLOT_PREFIX = '__batch__:';

/** True when `slot` names a saved batch session (vs a single-tool session). */
export function isBatchSlot(slot: unknown): slot is string {
  return typeof slot === 'string' && slot.startsWith(BATCH_SLOT_PREFIX);
}

/** Build the storage slot for a batch session label. */
export function batchSlot(name: string): string {
  return BATCH_SLOT_PREFIX + name;
}

/** Recover the human label from a batch slot (inverse of `batchSlot`). */
export function batchSlotName(slot: string): string {
  return slot.slice(BATCH_SLOT_PREFIX.length);
}
