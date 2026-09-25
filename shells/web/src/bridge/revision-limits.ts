// SPDX-License-Identifier: MPL-2.0
/** Payload budgets; metadata has additional overhead. Recovery is independent
 * so a full visible-history budget does not disable current-work protection. */
export const MAX_REVISION_BYTES = 256 * 1024 * 1024;
export const MAX_REVISION_PREVIEWS = 48 * 1024 * 1024;
export const MAX_RECOVERY_BYTES = 64 * 1024 * 1024;
/** One checkpoint, measured compressed: the deflated canonical JSON that
 * `revision-payloads` holds. A 32-slide deck of vector charts is about 7 MB of
 * JSON and 1.6 MB deflated, so it keeps automatic history. */
export const MAX_REVISION_SNAPSHOT = 4 * 1024 * 1024;
/** One checkpoint's canonical JSON before compression. Bounds the memory a read
 * inflates into, and matches the recovery budget, which keeps drafts as JSON. */
export const MAX_REVISION_EXPANDED = 64 * 1024 * 1024;
export const MAX_REVISION_ARCHIVE_BYTES = 384 * 1024 * 1024;
