// SPDX-License-Identifier: MPL-2.0
/**
 * The register: the moment the person has asked Lolly for a service (apply a
 * look, read the marks they dropped) and is waiting for the answer. Lolly's own spin
 * belongs here and nowhere else, so every such wait starts and ends through this
 * one pair.
 *
 * It keeps the busy state the callers already had, marks the container
 * (`aria-busy`, `data-register="busy"`) and shows Lolly's spin
 * (components/lolly-spin.ts) in it: `showLollySpin(container)` as a wait starts,
 * and `hideLollySpin(container)` as the last one on that container ends. A wait
 * shorter than SPIN_DELAY_MS never shows the spin, so a quick answer never
 * flashes the spin. Under Reduce motion the spin's mark stands still.
 *
 * Nested waits on one container count, so an inner wait that finishes first does
 * not clear the state of an outer one still running.
 */

import { hideLollySpin, showLollySpin } from '../../components/lolly-spin.ts';

const depth = new WeakMap<HTMLElement, number>();

/** How long a wait runs before the spin shows. */
export const SPIN_DELAY_MS = 150;

/** Start a wait on `container`. Returns the function that ends it; calling that
 *  more than once is harmless. */
export function beginRegister(container: HTMLElement): () => void {
  depth.set(container, (depth.get(container) ?? 0) + 1);
  container.setAttribute('aria-busy', 'true');
  container.dataset.register = 'busy';
  showLollySpin(container, { delayMs: SPIN_DELAY_MS });
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const left = (depth.get(container) ?? 1) - 1;
    if (left > 0) { depth.set(container, left); return; }
    depth.delete(container);
    container.removeAttribute('aria-busy');
    delete container.dataset.register;
    hideLollySpin(container);
  };
}

/** Run `work` as one wait on `container`, ending it however `work` settles. */
export async function withRegister<T>(container: HTMLElement, work: () => Promise<T>): Promise<T> {
  const end = beginRegister(container);
  try { return await work(); } finally { end(); }
}
