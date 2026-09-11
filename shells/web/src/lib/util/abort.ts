// SPDX-License-Identifier: MPL-2.0
/**
 * The one abort error the web shell raises.
 *
 * Eight modules (the speech, upscale, matte, OCR and depth paths) each carried
 * their own four-line copy of this, in two spellings - a `typeof DOMException`
 * test and a `try`/`catch` around the constructor. Both do the same thing, and
 * both exist for the same reason: a caller checks `err.name === 'AbortError'`,
 * so an aborted run has to be classifiable the same way an aborted `fetch` is,
 * including under jsdom and in a worker realm where `DOMException` may be
 * missing.
 *
 * This module is a leaf: it imports nothing, so anything may import it,
 * a module worker entry included.
 */

/** An `AbortError` - a real `DOMException` where the platform has one, and an
 *  `Error` renamed to match where it does not. */
export function abortError(message = 'aborted'): Error {
  try {
    return new DOMException(message, 'AbortError');
  } catch {
    return Object.assign(new Error(message), { name: 'AbortError' });
  }
}
