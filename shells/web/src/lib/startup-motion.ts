// SPDX-License-Identifier: MPL-2.0
/**
 * The gallery's ambient motion holds still while the shell's WebGPU startup check runs.
 *
 * boot() in main.ts marks `<html data-webgpu-pending>` when it starts the check and
 * removes the mark once the check settles, either way. Until then the gallery's
 * looping motion waits: the loading traces and pulsing dots, the featured strip's
 * Ken Burns, drift and cross-fade, the Cover Flow autoplay and motion previews. On a
 * slow machine with software graphics, the repaints those loops ask for every frame
 * delayed the device past its 30 s budget, and the shell then showed its
 * unsupported card on a machine that does support WebGPU.
 *
 * The CSS loops pause through `html[data-webgpu-pending]` rules (gallery.css,
 * featured.css) and carry on from the same frame afterwards. The JS loops ask
 * `startupMotionHeld()` on every beat, so they resume by themselves, and a motion
 * that starts on an event can wait for `onStartupMotionResume`. A page that never runs
 * the check (the docs site, a test harness, a worker) never carries the mark, so
 * nothing there is held. Reduced motion is unaffected: it already stops all of this.
 */

/** The mark boot() keeps on the root element while the check runs. */
export const STARTUP_PENDING_ATTRIBUTE = 'data-webgpu-pending';

/** Is the startup check still running, so ambient motion should hold still? */
export function startupMotionHeld(doc: Document | undefined = globalThis.document): boolean {
  return !!doc?.documentElement?.hasAttribute(STARTUP_PENDING_ATTRIBUTE);
}

/**
 * Run `run` when a hold that is on now lifts, for motion that starts on an event that has
 * already passed (a centred tile, a resting pointer). Nothing runs when nothing is held,
 * so a caller behaves exactly as before on a page that never ran the check. Returns a
 * cancel.
 */
export function onStartupMotionResume(run: () => void, doc: Document | undefined = globalThis.document): () => void {
  if (!doc || !startupMotionHeld(doc)) return () => {};
  const View = doc.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new View(() => {
    if (startupMotionHeld(doc)) return;
    observer.disconnect();
    run();
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: [STARTUP_PENDING_ATTRIBUTE] });
  return () => observer.disconnect();
}
