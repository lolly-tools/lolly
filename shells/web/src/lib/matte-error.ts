// SPDX-License-Identifier: MPL-2.0
/**
 * Turn a matte RUN failure into a small, human-actionable category so the dialog
 * never shows a raw runtime string. The one this exists for: ort-web aborts a
 * too-heavy run with `failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE:
 * std::bad_alloc` - the wasm32 heap ran out (canRun can't model a transformer's
 * activation memory, so a run can still OOM after a green feasibility check). That
 * verbatim C++ string in a friendly dialog is the exact papercut this removes.
 *
 * Classification is MESSAGE-first, not class-first, on purpose: the wasm runner
 * throws inside a Worker, so its typed errors (ModelNotInstalledError) and ORT's
 * exceptions cross postMessage as PLAIN Errors whose class is gone but whose text
 * survives. The native desktop path throws real typed errors on the main thread,
 * so we match name too. Pure + DOM-free so it is unit-tested (matte-error.test.ts)
 * and the presentation (t()) stays in the dialog.
 */

export type MatteErrorKind = 'aborted' | 'not-installed' | 'memory' | 'generic';

export function classifyMatteError(e: unknown): MatteErrorKind {
  const err = e as { name?: string; message?: string } | null | undefined;
  const name = err?.name ?? '';
  const msg = String(err?.message ?? e ?? '').toLowerCase();

  if (name === 'AbortError') return 'aborted';

  if (name === 'ModelNotInstalledError'
    || /isn.?t downloaded|not downloaded|not installed|not-installed|modelnotinstalled/.test(msg)) {
    return 'not-installed';
  }

  // Out-of-memory, however the runtime phrases it: ORT's std::bad_alloc, a JS
  // RangeError (buffer allocation), or wasm heap-growth / bounds failures. Keyed on
  // an actual allocation/memory word - ORT's ERROR_CODE 6 alone is a generic runtime
  // exception (a bad input rank is also code 6), so it stays 'generic'.
  if (name === 'RangeError'
    || /bad_alloc|out of memory|cannot allocate|allocation failed|failed to grow|out of bounds|\boom\b/.test(msg)) {
    return 'memory';
  }

  return 'generic';
}
