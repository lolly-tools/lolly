// SPDX-License-Identifier: MPL-2.0
/**
 * Palette colour wheel - every brand colour plotted on an OKLCH hue/chroma disc:
 * angle = hue (0° at top, clockwise), distance from the centre = chroma (vivid
 * colours reach the rim), dot fill = the colour itself.
 *
 * Greys are NOT on the disc. A neutral has no hue to plot by, so every one of
 * them used to pile into the hub at an arbitrary angle; instead they ride a
 * lightness RAIL beside the disc (light at the top), which also gives lightness
 * - otherwise a non-positional axis here - somewhere to be read. See
 * palette-wheel-geom.ts (isNeutral / railY).
 *
 * Two modes off one geometry (oklchWheelXY / wheelXYToChromaHue / railY, all pure
 * + unit-tested):
 *  - renderPaletteWheel / wirePaletteWheel - the Dashboard's read-only instrument
 *    dial (hover a dot to read it).
 *  - renderBrandWheel / wireBrandWheel - the brand editor's LIVE wheel: drag a dot
 *    to recolour it (hue+chroma from where you drop it, lightness kept), click a
 *    dot to edit/delete it, click empty space to drop a new one there.
 */

import './palette-wheel.css';
import { hexToOklch, oklchToHex, formatOklch } from '@lolly/engine';
import { escapeHtml } from './html.ts';
import {
  WHEEL_NEUTRAL_C, oklchWheelXY, wheelXYToChromaHue, isNeutral, railY, railYToL,
} from './palette-wheel-geom.ts';

export interface WheelColor { hex: string; label: string }

// Re-export the pure geometry so palette-wheel remains the one import site.
export {
  WHEEL_R, WHEEL_R_IN, WHEEL_CMAX, WHEEL_NEUTRAL_C,
  oklchWheelXY, wheelXYToChromaHue, isNeutral, railY, railYToL,
} from './palette-wheel-geom.ts';

/** Where a colour plots: on the chromatic disc, or on the neutral rail beside it.
 *  `light` flags a pale dot, which needs an outline to survive a pale background. */
interface Plot { x: number; y: number; light: boolean; rail: boolean }

/** #rrggbb → its plot, or null when it isn't a resolvable colour. */
function hexPlot(hex: string): Plot | null {
  const o = hexToOklch(hex);
  if (!o) return null;
  const light = o.l > 0.82;
  if (isNeutral(o)) return { x: 50, y: railY(o.l), light, rail: true };
  const { x, y } = oklchWheelXY(o);
  return { x, y, light, rail: false };
}

/** The disc + the rail, as one plot area. Callers supply the dots for each.
 *  `edit` adds the editable surfaces' affordance classes (crosshair / touch-action). */
function plotHtml(
  discDots: string, railDots: string,
  discAttrs: string, railAttrs: string,
  edit = false,
): string {
  const e = edit ? ' is-editable' : '';
  return `
    <div class="dash-wheel-plot">
      <div class="dash-wheel${e}" ${discAttrs}>
        <div class="dash-wheel-ring" aria-hidden="true"></div>
        <div class="dash-wheel-grid" aria-hidden="true"></div>
        ${discDots}
      </div>
      <div class="dash-wheel-rail${e}" ${railAttrs}>
        <div class="dash-wheel-rail-track" aria-hidden="true"></div>
        ${railDots}
      </div>
    </div>`;
}

// ── Read-only instrument dial (Dashboard bento) ──────────────────────────────

export function renderPaletteWheel(colors: readonly WheelColor[]): string {
  const dot = (c: WheelColor, p: Plot): string =>
    `<button type="button" class="dash-wheel-dot${p.light ? ' is-light' : ''}" role="listitem"
      style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;--dot:${escapeHtml(c.hex)}"
      data-label="${escapeHtml(c.label)}" data-hex="${escapeHtml(c.hex.toUpperCase())}"
      aria-label="${escapeHtml(c.label)} ${escapeHtml(c.hex)}"></button>`;

  let disc = '', rail = '';
  for (const c of colors) {
    const p = hexPlot(c.hex);
    if (!p) continue;
    if (p.rail) rail += dot(c, p); else disc += dot(c, p);
  }
  return `
    <div class="dash-wheel-wrap">
      ${plotHtml(disc, rail,
        'role="list" aria-label="Palette colours plotted by hue and chroma"',
        'role="list" aria-label="Neutral colours, plotted by lightness"')}
      <div class="dash-wheel-preview" data-wheel-preview aria-hidden="true">
        <span class="dash-wheel-pv-swatch" data-wheel-pv-swatch aria-hidden="true"></span>
        <span class="dash-wheel-pv-text">
          <span class="dash-wheel-pv-name" data-wheel-pv-name>Hover a colour to read it</span>
          <code class="dash-wheel-pv-hex" data-wheel-pv-hex></code>
        </span>
      </div>
    </div>`;
}

/** Wire the readout beneath the read-only wheel: hover/focus a dot → name + hex. */
export function wirePaletteWheel(root: HTMLElement): void {
  const plot = root.querySelector<HTMLElement>('.dash-wheel-plot');
  if (!plot) return;
  const pv = root.querySelector<HTMLElement>('[data-wheel-preview]');
  const pvSw = pv?.querySelector<HTMLElement>('[data-wheel-pv-swatch]') ?? null;
  const pvNm = pv?.querySelector<HTMLElement>('[data-wheel-pv-name]') ?? null;
  const pvHx = pv?.querySelector<HTMLElement>('[data-wheel-pv-hex]') ?? null;
  const clear = (): void => {
    pv?.classList.remove('is-active');
    if (pvSw) pvSw.style.background = 'transparent';
    if (pvNm) pvNm.textContent = 'Hover a colour to read it';
    if (pvHx) pvHx.textContent = '';
  };
  const show = (dot: HTMLElement): void => {
    pv?.classList.add('is-active');
    if (pvSw) pvSw.style.background = dot.dataset.hex || '';
    if (pvNm) pvNm.textContent = dot.dataset.label || '';
    if (pvHx) pvHx.textContent = dot.dataset.hex || '';
  };
  plot.querySelectorAll<HTMLElement>('.dash-wheel-dot').forEach((dot) => {
    dot.addEventListener('pointerenter', () => show(dot));
    dot.addEventListener('focus', () => show(dot));
    dot.addEventListener('pointerleave', clear);
    dot.addEventListener('blur', clear);
  });
}

// ── Editable wheel (brand editor) ─────────────────────────────────────────────

export interface WheelDot { idx: number; hex: string; label: string }

export interface BrandWheelHandlers {
  /** Live during a drag: the dot moved to this hue/chroma (lightness + alpha kept). */
  onRecolor(idx: number, oklch: { l: number; c: number; h: number; alpha?: number }): void;
  /** The drag ended - a good moment to persist. */
  onCommit(idx: number): void;
  /** A dot was clicked (not dragged) - open its editor. */
  onPick(idx: number): void;
  /** Empty space was clicked - drop a new swatch seeded at this hue/chroma. */
  onAdd(seed: { l: number; c: number; h: number }): void;
  /** Current hex of a dot (drags keep its lightness). */
  hexOf(idx: number): string;
}

function dotHtml(d: WheelDot, p: Plot): string {
  const where = p.rail ? 'drag to relight' : 'drag to recolour';
  return `<button type="button" class="dash-wheel-dot dash-wheel-dot--edit${p.light ? ' is-light' : ''}"
    style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;--dot:${escapeHtml(d.hex || 'transparent')}"
    data-be-widx="${d.idx}" data-hex="${escapeHtml((d.hex || '').toUpperCase())}"
    aria-label="${escapeHtml(d.label)} ${escapeHtml(d.hex)} - ${where}, click to edit"></button>`;
}

/** The editable wheel's markup. Dots carry `data-be-widx` (their swatch index). */
export function renderBrandWheel(dots: readonly WheelDot[]): string {
  let disc = '', rail = '';
  for (const d of dots) {
    const p = hexPlot(d.hex) ?? { x: 50, y: 50, light: false, rail: false };
    if (p.rail) rail += dotHtml(d, p); else disc += dotHtml(d, p);
  }
  return `
    ${plotHtml(disc, rail,
      'data-be-wheel role="group" aria-label="Palette wheel - drag a dot to recolour, click to edit, click empty space to add"',
      'data-be-rail role="group" aria-label="Neutral rail - drag a grey up or down to relight it, click to edit"',
      true)}
    <p class="be-wheel-hint">Angle = hue · distance out = chroma · greys ride the rail, where height = lightness. Drag to recolour · click to edit · click empty space to add.</p>`;
}

/**
 * Wire the editable wheel. Returns a teardown. Pointer capture on the wheel makes
 * a drag continue even when the pointer leaves the disc; a press that doesn't move
 * past a small threshold is treated as a click (edit a dot / add on empty space).
 */
export function wireBrandWheel(root: HTMLElement, h: BrandWheelHandlers): () => void {
  const wheel = root.querySelector<HTMLElement>('[data-be-wheel]');
  const rail = root.querySelector<HTMLElement>('[data-be-rail]');
  if (!wheel || !rail) return () => {};
  const teardowns: Array<() => void> = [];

  // Both surfaces run the same press/drag/click machine; they differ only in what
  // a position MEANS. The disc reads hue+chroma out of a point (lightness kept);
  // the rail reads lightness out of a height (hue+chroma kept) - a grey has no
  // hue to drag, so its one real axis is the only thing the rail moves.
  const wire = (
    surface: HTMLElement,
    recolor: (idx: number, x: number, y: number) => void,
    add: (x: number, y: number) => void,
  ): void => {
    let dragIdx = -1;       // the dot being pressed (-1 = pressing empty space)
    let moved = false;      // has the pointer travelled past the click threshold
    let startX = 0, startY = 0;
    let pointerId = -1;

    const posPct = (e: PointerEvent): { x: number; y: number } => {
      const r = surface.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    };

    const onDown = (e: PointerEvent): void => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>('[data-be-widx]');
      dragIdx = dot ? Number(dot.dataset.beWidx) : -1;
      moved = false; startX = e.clientX; startY = e.clientY; pointerId = e.pointerId;
      surface.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent): void => {
      if (pointerId !== e.pointerId) return;
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
      moved = true;
      if (dragIdx < 0) return; // dragging on empty space isn't a recolour
      const { x, y } = posPct(e);
      recolor(dragIdx, x, y);
    };
    const onUp = (e: PointerEvent): void => {
      if (pointerId !== e.pointerId) return;
      if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
      pointerId = -1;
      if (moved) { if (dragIdx >= 0) h.onCommit(dragIdx); }
      else if (dragIdx >= 0) h.onPick(dragIdx);
      else { const { x, y } = posPct(e); add(x, y); }
      dragIdx = -1;
    };
    surface.addEventListener('pointerdown', onDown);
    surface.addEventListener('pointermove', onMove);
    surface.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onUp);
    teardowns.push(() => {
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onUp);
    });
  };

  // The disc: position → hue + chroma. Lightness AND opacity are kept, so a drag
  // only moves the colour around the hue plane. Dragging one all the way into the
  // hub desaturates it past the neutral threshold, and updateWheelDot hands the
  // dot over to the rail mid-drag.
  wire(wheel, (idx, x, y) => {
    const { c, h: hue } = wheelXYToChromaHue(x, y);
    const cur = hexToOklch(h.hexOf(idx)) ?? { l: 0.62, c, h: hue };
    h.onRecolor(idx, { l: cur.l, c, h: hue, alpha: cur.alpha });
  }, (x, y) => {
    const { c, h: hue } = wheelXYToChromaHue(x, y);
    // Floor the chroma at the neutral threshold: a swatch added on the disc must
    // land ON the disc, not teleport straight to the rail.
    h.onAdd({ l: 0.62, c: Math.max(c, WHEEL_NEUTRAL_C), h: hue });
  });

  // The rail: height → lightness. Hue + chroma (and opacity) are kept.
  wire(rail, (idx, _x, y) => {
    const cur = hexToOklch(h.hexOf(idx)) ?? { l: railYToL(y), c: 0, h: 0 };
    h.onRecolor(idx, { l: railYToL(y), c: cur.c, h: cur.h, alpha: cur.alpha });
  }, (_x, y) => {
    h.onAdd({ l: railYToL(y), c: 0, h: 0 }); // a true grey
  });

  return () => { for (const t of teardowns) t(); };
}

/** Move + recolour a single live dot in place (during a drag) without a re-render.
 *  A drag can carry a colour across the neutral threshold, so the dot may have to
 *  change SURFACE too - hop between the disc and the rail - which means re-parenting
 *  it, not just repositioning it. */
export function updateWheelDot(root: HTMLElement, idx: number, hex: string): void {
  const dot = root.querySelector<HTMLElement>(`[data-be-widx="${idx}"]`);
  if (!dot) return;
  const p = hexPlot(hex);
  if (p) {
    const home = root.querySelector<HTMLElement>(p.rail ? '[data-be-rail]' : '[data-be-wheel]');
    if (home && dot.parentElement !== home) home.appendChild(dot);
    dot.style.left = `${p.x.toFixed(2)}%`;
    dot.style.top = `${p.y.toFixed(2)}%`;
    dot.classList.toggle('is-light', p.light);
  }
  dot.style.setProperty('--dot', hex || 'transparent');
  dot.dataset.hex = (hex || '').toUpperCase();
}

/** Format an OKLCH value as the `oklch()` string the DTCG doc stores (alpha kept
 *  as `/ a` when < 1, via formatOklch). */
export function oklchToStored(o: { l: number; c: number; h: number; alpha?: number }): string {
  return formatOklch(o);
}
/** OKLCH → hex (hex8 when alpha < 1), for live tile/preview repaint alongside a drag. */
export function oklchHex(o: { l: number; c: number; h: number; alpha?: number }): string {
  return oklchToHex(o);
}
