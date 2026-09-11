// SPDX-License-Identifier: MPL-2.0
/**
 * Visual-viewport inset maths: the pure half of main.ts's trackVisualViewport
 * (which publishes the result as the --vv-* CSS vars every bottom-pinned
 * surface rides) and of the lift components/spotlight.ts applies to its panel.
 *
 * Pure because neither case it decides between is reachable on a desktop
 * browser - there is no retractable URL bar and no soft keyboard to measure -
 * so the branch is only ever checked by the test beside this file.
 */

/** Live viewport measurements, all in CSS px, as one call reads them. */
export interface ViewportMetrics {
  /** visualViewport.scale */
  scale: number;
  /** window.innerHeight - the LAYOUT viewport height a fixed element pins to. */
  innerHeight: number;
  /** documentElement.clientWidth */
  clientWidth: number;
  /** documentElement.clientHeight */
  clientHeight: number;
  /** visualViewport.width */
  vvWidth: number;
  /** visualViewport.height */
  vvHeight: number;
  /** visualViewport.offsetTop */
  offsetTop: number;
  /** visualViewport.offsetLeft */
  offsetLeft: number;
}

/** Distance from each layout-viewport edge to the visible area, in CSS px. */
export interface ViewportInsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// Occlusion at the bottom that can only be a soft keyboard, never a retracting
// browser toolbar. The two magnitudes are far apart and never overlap: a mobile
// URL bar (plus a bottom toolbar) takes ~56-100px of the visual viewport, while
// a soft keyboard takes ~250px and up. Anything past this threshold is a
// keyboard, so lifting bottom-pinned chrome by it cannot fight the toolbar.
// It also has to clear the desktop scrollbar delta: innerHeight counts a
// classic horizontal scrollbar, visualViewport.height does not, so an
// un-occluded desktop page can read ~15px of "occlusion".
export const KEYBOARD_MIN_OCCLUSION = 140;

export function computeViewportInsets(m: ViewportMetrics): ViewportInsets {
  // Re-pin all four edges only while genuinely pinch-zoomed (scale > 1), where
  // position:fixed pins to the layout viewport and the visible area has moved
  // away from it entirely.
  if (m.scale > 1.01) {
    const top = Math.max(0, m.offsetTop);
    const left = Math.max(0, m.offsetLeft);
    return {
      top,
      left,
      right: Math.max(0, m.clientWidth - left - m.vvWidth),
      bottom: Math.max(0, m.clientHeight - top - m.vvHeight),
    };
  }
  // At scale 1 the visual and layout viewports can still differ, for two
  // reasons that must NOT be treated alike:
  //
  //  - a mobile browser's retractable toolbar (URL bar) shrinks the visual
  //    viewport as it shows/hides on scroll. There position:fixed already
  //    tracks the layout-viewport edges, so a computed inset would wrongly
  //    float a bottom-pinned bar up above where the (often hidden) controls
  //    sit, and have it drift as you scroll. Zeroing hands that case back to
  //    native bottom:0.
  //  - the soft keyboard covers the bottom of the layout viewport without
  //    moving its edges, so native bottom:0 puts the footer search field, the
  //    toasts and the action pills BEHIND the keyboard. That one needs the
  //    inset, and only at the bottom.
  //
  // The threshold above is what separates them. Top/left/right stay 0 either
  // way: a keyboard only ever eats the bottom.
  const occlusion = m.innerHeight - m.vvHeight - Math.max(0, m.offsetTop);
  const bottom = occlusion >= KEYBOARD_MIN_OCCLUSION ? Math.round(occlusion) : 0;
  return { top: 0, left: 0, right: 0, bottom };
}
