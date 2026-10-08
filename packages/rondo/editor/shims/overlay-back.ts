// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's Back-button stack (lib/overlay-back.ts) for the editor frame.
 * The frame is a document with no history of its own to push to, so an open
 * popover takes no history entry; Escape, an outside tap and its own controls
 * still close the popover.
 */
export interface OverlayRecord {
  nav(): void;
  pop(): void;
}
export interface OverlayEntry {
  disown(): void;
  release(): void;
}
export function registerOverlay(_record: OverlayRecord): OverlayEntry {
  return { disown() {}, release() {} };
}
