// SPDX-License-Identifier: MPL-2.0
/**
 * Who owns a press on the tool stage.
 *
 * The stage navigation (views/tool-stage-nav.ts) pans and pinches the view on any
 * pointer that bubbles up to the stage, and pans it on a plain wheel once it is zoomed.
 * An element that handles its own presses says so with `data-stage-gestures="own"`: a
 * press that starts inside that element is not tracked for the stage's pan or pinch, and
 * a plain wheel over the element is left to the element. Ctrl or Cmd with the wheel, and
 * a trackpad pinch (which the browser sends as the same thing), still zoom the stage.
 *
 * The stage kit's layer carries the mark (lib/stage-kit.ts), and so does a canvas that
 * moves a camera of its own, such as 3D Studio's (lib/studio3d/mount.ts).
 */
export const STAGE_GESTURES_ATTR = 'data-stage-gestures';
export const STAGE_GESTURES_OWN = `[${STAGE_GESTURES_ATTR}="own"]`;

/** True when a press or wheel that starts at `target` belongs to an element that owns its gestures. */
export function ownsStageGestures(target: EventTarget | null): boolean {
  const node = target as { closest?: (selector: string) => Element | null } | null;
  return typeof node?.closest === 'function' && node.closest(STAGE_GESTURES_OWN) !== null;
}
