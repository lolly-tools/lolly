// SPDX-License-Identifier: MPL-2.0
/**
 * Type guards for values that arrive from outside the shell - a wire message, a
 * stored record, a parsed JSON blob.
 *
 * This module is a leaf: it imports nothing, so anything may import it.
 */

/** True for a plain object, false for an array. The collab wire decoders reject a
 *  malformed envelope on that distinction. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
