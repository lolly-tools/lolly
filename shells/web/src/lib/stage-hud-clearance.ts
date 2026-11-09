// SPDX-License-Identifier: MPL-2.0
/**
 * Where a fitted tool canvas keeps clear of the phone zoom HUD (fitCanvas in
 * views/tool/stage-layout.ts).
 *
 * On a phone the HUD hangs from the top-right corner of the stage. Folded, the HUD is
 * the lolly swirl alone, and the canvas is fitted below the swirl. Unfolded, the HUD is
 * a column of buttons that reaches most of the way down the visible stage: 279px on a
 * 393 x 659 iPhone viewport, where the band between the controls sheet and the Export
 * pill is 272px. Reserving the column's height above the canvas left no room, so the
 * fit fell to its 40px floor and the top margin pushed the canvas behind the Export
 * pill. The preview looked empty until a zoom pulled the canvas back into the band.
 *
 * So a HUD that reaches past the middle of the band is a column beside the canvas, and
 * the canvas is fitted next to the column instead of below.
 */

/** A client rect: the four edges this reads. */
export interface ClearanceBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Margins in px that keep the fitted canvas clear of the HUD. */
export interface HudClearance {
  top: number;
  left: number;
  right: number;
}

/**
 * @param hud  The HUD's client rect, or null when there is no HUD to clear.
 * @param band The part of the stage the canvas may use before the HUD is counted:
 *             below the controls sheet and above the Export pill.
 */
export function hudClearance(hud: ClearanceBox | null | undefined, band: ClearanceBox): HudClearance {
  const none = { top: 0, left: 0, right: 0 };
  if (!hud || !(hud.right > hud.left) || !(hud.bottom > hud.top)) return none;
  const height = band.bottom - band.top;
  if (!(height > 0) || !(band.right > band.left)) return none;
  const below = Math.max(0, hud.bottom - band.top);
  if (below <= height / 2) return { ...none, top: below };
  // Clear the edge the column stands against: the one nearer its centre.
  const onRight = hud.left + hud.right > band.left + band.right;
  const beside = Math.max(0, onRight ? band.right - hud.left : hud.right - band.left);
  return onRight ? { ...none, right: beside } : { ...none, left: beside };
}
