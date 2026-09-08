// SPDX-License-Identifier: MPL-2.0
/** Payload budgets; metadata has additional overhead. Recovery is independent
 * so a full visible-history budget does not disable current-work protection. */
export const MAX_REVISION_BYTES = 256 * 1024 * 1024;
export const MAX_REVISION_PREVIEWS = 48 * 1024 * 1024;
export const MAX_RECOVERY_BYTES = 64 * 1024 * 1024;
export const MAX_REVISION_SNAPSHOT = 4 * 1024 * 1024;
export const MAX_REVISION_ARCHIVE_BYTES = 384 * 1024 * 1024;
