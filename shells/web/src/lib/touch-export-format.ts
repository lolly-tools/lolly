// SPDX-License-Identifier: MPL-2.0
/**
 * The export sheet's starting format on a touch-only device (plan 320 H2).
 *
 * A tool lists its formats best first for a desk: the QR code leads with SVG. On a
 * phone an SVG is the one file the camera roll, the share sheet and most chat apps
 * cannot open, so a tool that leads with SVG and also offers PNG starts on PNG there.
 * Every other list is left alone, and an explicit choice (a ?format= link or a saved
 * session) never reaches this: the caller only asks when nothing was chosen.
 */

/** Touch is the only pointer: no mouse or trackpad attached. */
export function touchOnly(): boolean {
  try { return !!window.matchMedia?.('(pointer: coarse) and (hover: none)').matches; } catch { return false; }
}

export function startingFormat(formats: readonly string[], touch: boolean = touchOnly()): string | undefined {
  if (touch && formats[0] === 'svg' && formats.includes('png')) return 'png';
  return formats[0];
}
