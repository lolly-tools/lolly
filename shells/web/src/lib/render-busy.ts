// SPDX-License-Identifier: MPL-2.0
/**
 * Whether a real render is running: an export, a batch, a folder download. Idle
 * preview work (lib/preview-idle.ts) waits while one is, so a picture redraw never
 * competes with something the person asked for. A counter, not a flag, because
 * batch renders overlap.
 */
let running = 0;

/** Mark a render as started; call the returned function when it ends. */
export function beginRender(): () => void {
  running++;
  let ended = false;
  return () => { if (!ended) { ended = true; running = Math.max(0, running - 1); } };
}

/** True while any render that is not a preview is running. */
export function renderBusy(): boolean {
  return running > 0;
}
