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

/** True when `value` is an object with a function under each of `keys`: a host
 *  slice checked member by member where its declared type is narrower. */
export function hasMethods(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'function');
}
