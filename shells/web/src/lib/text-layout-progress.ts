// SPDX-License-Identifier: MPL-2.0
/**
 * How many text layouts the web host has finished: one per `host.text.layoutRuns`
 * call, which a composed-text tool (Design) makes once per story. The "Opening…" card
 * (views/tool/open-document.ts) reads this against the document's story count to show
 * "Laying out text: 34 of 106" while a long document composes, instead of a step name
 * that sits still for ten seconds.
 *
 * Module state, like the rest of the tool view's one-mounted-tool plumbing, and a
 * count only: nothing here knows or keeps what was laid out.
 */

let completed = 0;
const listeners = new Set<(completed: number) => void>();

/** A layoutRuns call finished, however it ended. */
export function noteTextLayoutDone(): void {
  completed += 1;
  for (const listener of [...listeners]) listener(completed);
}

/** Layouts finished so far, as a mark to count from. */
export function textLayoutsDone(): number {
  return completed;
}

/** Hear each finished layout. Returns the unsubscribe. */
export function onTextLayoutDone(listener: (completed: number) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
