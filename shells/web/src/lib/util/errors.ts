// SPDX-License-Identifier: MPL-2.0
/**
 * Turning a caught `unknown` into something a person can read.
 *
 * This module is a leaf: it imports nothing, so anything may import it.
 */

/** An `Error`'s message, or the value stringified. For anything shown to a
 *  user or written to a log line. */
export function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
