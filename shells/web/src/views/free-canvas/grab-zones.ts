// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: GIMP's crop-tool grab zones (plan 311). A finger, or a mouse or a pen
 * when the person turns on "Large grab areas", gets large zones round the selection:
 * each corner a quarter of the visible rect (24 to 44 screen px), each side the edge
 * between two corners, and outside the rect when it is too small for them (narrow
 * mode). The zones themselves are the grab zones of zones.ts, sized large; this module
 * owns the preference and the wash that shows the zone a press there would take.
 *
 * The preference is a device-local view preference, like "Rulers and guides": a
 * `lolly-` key in localStorage, read once per mount, off by default, and never a
 * profile setting, since the right answer differs between a trackpad and a tablet.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 */
import type { PointerKind, ZoneRect } from '../free-canvas-transform.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';

/** Where "Large grab areas" is kept on this device: 'true' or 'false'. */
export const LARGE_GRAB_KEY = 'lolly-design-large-grab-areas';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** The stored preference. Storage that is blocked or throws reads as off. */
export function storedLargeGrab(): boolean {
  try { return localStorage.getItem(LARGE_GRAB_KEY) === 'true'; } catch { return false; }
}

/** Does this pointer get the large zones? A finger always does; a mouse or a pen when
 *  "Large grab areas" is on (plan 311 Amendment 4: a pen follows the mouse). */
export function largeFor(fc: FcCtx, kind: PointerKind): boolean {
  return kind === 'touch' || fc.largeGrab;
}

/**
 * Turn "Large grab areas" on or off: keep the choice on this device, lay the chrome out
 * again (its handles let the press through to the zones, and the rotate handle moves
 * past a narrow selection's zones) and announce the change.
 */
export function setLargeGrab(fc: FcCtx, on: boolean): void {
  if (fc.largeGrab === on) return;
  fc.largeGrab = on;
  try { localStorage.setItem(LARGE_GRAB_KEY, String(on)); } catch { /* best effort: the choice holds until the editor closes */ }
  fc.chromeSync.renderChrome();
  announce(on ? t('Large grab areas on') : t('Large grab areas off'));
}
export function toggleLargeGrab(fc: FcCtx): void {
  setLargeGrab(fc, !fc.largeGrab);
}

// ── The wash ─────────────────────────────────────────────────────────────────

const washes = new WeakMap<FcCtx, SVGSVGElement>();
const round = (v: number): number => Math.round(v * 100) / 100;

/**
 * Wash one zone: a translucent fill over each of its parts, drawn from the same quads
 * the hit test uses (zoneRects), so the wash is exactly where a press takes that zone.
 * The quads are client px; the overlay is placed in stage px. It sits under the
 * outline and the handles, and screen readers skip it: the zone is a pointer target,
 * and the handles it stands for carry the meaning.
 */
export function showWash(fc: FcCtx, zone: ZoneRect): void {
  let el = washes.get(fc);
  if (!el) {
    el = document.createElementNS(SVG_NS, 'svg');
    el.setAttribute('class', 'fc-zone');
    el.setAttribute('aria-hidden', 'true');
    washes.set(fc, el);
  }
  if (el.parentNode !== fc.overlay) fc.overlay.insertBefore(el, fc.chrome?.parentNode === fc.overlay ? fc.chrome : null);
  const { sr } = fc.stage.metrics();
  el.setAttribute('data-zone', `${zone.kind}-${zone.handle}`);
  el.replaceChildren(...zone.quads.map((quad) => {
    const part = document.createElementNS(SVG_NS, 'polygon');
    part.setAttribute('points', quad.map((p) => `${round(p.x - sr.left)},${round(p.y - sr.top)}`).join(' '));
    return part;
  }));
}
/** Take the wash away: the pointer left the zone, or the press ended or became a drag. */
export function hideWash(fc: FcCtx): void {
  washes.get(fc)?.remove();
}

export function grabZonesOps(fc: FcCtx) {
  return {
    largeFor: bindOp(fc, largeFor),
    set: bindOp(fc, setLargeGrab),
    toggle: bindOp(fc, toggleLargeGrab),
    showWash: bindOp(fc, showWash),
    hideWash: bindOp(fc, hideWash),
  };
}
