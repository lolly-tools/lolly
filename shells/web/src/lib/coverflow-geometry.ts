// SPDX-License-Identifier: MPL-2.0
/** Shared by the static Docs landing and the app's glass tile carousel. */
export const COVERFLOW_TUCK = 0.52;

export function coverflowPose(distance: number, width: number): { transform: string; tuck: number; zIndex: string } {
  const cd = Math.max(-1.4, Math.min(1.4, distance));
  const td = Math.max(-6, Math.min(6, distance));
  const angle = -cd * 50;
  const scale = 1 - Math.min(Math.abs(distance), 1) * 0.28;
  const tuck = -td * width * COVERFLOW_TUCK;
  const back = width / 2 * scale * Math.abs(Math.sin(angle * Math.PI / 180)) + Math.abs(td) * 8 + 2;
  return {
    transform: `translate3d(${tuck.toFixed(1)}px,0,${(-back).toFixed(1)}px) rotateY(${angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    tuck,
    zIndex: String(1000 - Math.round(Math.abs(distance) * 20)),
  };
}
