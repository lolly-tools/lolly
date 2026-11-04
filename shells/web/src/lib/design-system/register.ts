// SPDX-License-Identifier: MPL-2.0
/**
 * The register: the moment the person has asked Lolly for a service (apply a
 * look, read the marks they dropped) and is waiting for the answer. Lolly's own spin
 * belongs here and nowhere else, so every such wait starts and ends through this
 * one pair.
 *
 * Today it keeps the busy state the callers already had and marks the container
 * (`aria-busy`, `data-register="busy"`). components/lolly-spin.ts joins at the two
 * marked lines below: `showLollySpin(container)` as a wait starts, and
 * `hideLollySpin()` as the last one on that container ends.
 *
 * Nested waits on one container count, so an inner wait that finishes first does
 * not clear the state of an outer one still running.
 */

const depth = new WeakMap<HTMLElement, number>();

/** Start a wait on `container`. Returns the function that ends it; calling that
 *  more than once is harmless. */
export function beginRegister(container: HTMLElement): () => void {
  depth.set(container, (depth.get(container) ?? 0) + 1);
  container.setAttribute('aria-busy', 'true');
  container.dataset.register = 'busy';
  // components/lolly-spin.ts: showLollySpin(container) joins here.
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const left = (depth.get(container) ?? 1) - 1;
    if (left > 0) { depth.set(container, left); return; }
    depth.delete(container);
    container.removeAttribute('aria-busy');
    delete container.dataset.register;
    // components/lolly-spin.ts: hideLollySpin() joins here.
  };
}

/** Run `work` as one wait on `container`, ending it however `work` settles. */
export async function withRegister<T>(container: HTMLElement, work: () => Promise<T>): Promise<T> {
  const end = beginRegister(container);
  try { return await work(); } finally { end(); }
}
