// SPDX-License-Identifier: MPL-2.0
/**
 * curve-editor.ts - an inline, DOM-light editor for one ramp's tonal curve.
 *
 * A ramp is three per-channel curves (L lightness, C chroma, H hue) of control
 * points over tone position t ∈ [0, 1] (engine ColorCurve). This mounts a small
 * SVG plot of ONE channel at a time (an L/C/H toggle switches which), with each
 * control point draggable in VALUE, and a live baked-swatch strip beside it
 * (bakeCurve). Every drag calls `onChange(curve)`; the host (brand-editor)
 * decides what to do with the new curve (preview + draft, then commit on "Use
 * this colour").
 *
 * It is deliberately generic and self-contained - the ramp identity, the
 * "Rebuild from colour" reset and the open/close chrome all live in the host, so
 * this module can be unit-tested headless. The pure geometry + hit-test helpers
 * below are exported for exactly that (curve-editor.test.ts); the mount function
 * is the only DOM-touching surface.
 *
 * Motion: any transition is CSS-gated (parts/brand-studio.css keys off the
 * reduced-motion blocks); prefersReducedMotion() additionally suppresses the
 * one JS-set drag class so a dragged point never eases when the user asked for
 * stillness.
 */

import { bakeCurve, formatOklch, sampleCurve } from '@lolly/engine';
import type { ColorCurve, ChannelCurve, CurvePoint } from '@lolly/engine';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { escape } from '../utils.ts';

export type Channel = 'L' | 'C' | 'H';

/** A closed value range for a channel's vertical axis. */
export interface Range { min: number; max: number; }

/** The plot's geometry in viewBox units (the SVG scales to its CSS box). */
export interface PlotGeom { w: number; h: number; pad: number; }

/** The default plot geometry - a wide, short strip that sits under the preview. */
export const PLOT: PlotGeom = { w: 320, h: 120, pad: 12 };

/** Fixed axis extents per channel. C's ceiling is expanded per-render when a
 *  hand-tuned curve pushes chroma past it (see `chromaRange`), so the plot never
 *  clips a legitimately saturated stop. */
export const CHANNEL_RANGE: Record<Channel, Range> = {
  L: { min: 0, max: 1 },
  C: { min: 0, max: 0.4 },
  H: { min: 0, max: 360 },
};

/** One arrow-press value step per channel - the keyboard equal of a small drag.
 *  Shift multiplies by {@link KEY_BIG}. Matches the palette grid's nudge steps. */
export const CHANNEL_STEP: Record<Channel, number> = { L: 0.02, C: 0.01, H: 2 };
/** Shift-held multiplier for a coarse value jump. */
export const KEY_BIG = 5;

/**
 * Step a control point's VALUE by one keyboard press, clamped to the channel's
 * axis range - the pure half of Arrow Up/Down on a focused point. Unlike the
 * palette grid's `nudgeSwatch` (a cyclic hue), a curve point sits on a bounded
 * 0–360 axis, so H CLAMPS here exactly as the pointer drag does (yToV clamps).
 */
export function stepPointValue(v: number, channel: Channel, dir: 1 | -1, big: boolean, r: Range): number {
  const step = CHANNEL_STEP[channel] * (big ? KEY_BIG : 1) * dir;
  return Math.min(r.max, Math.max(r.min, v + step));
}

/** The adjacent point index for ←/→ roving focus, clamped to [0, count-1] (the
 *  ends don't wrap - a control point list is ordered, not a ring). */
export function rovingIndex(current: number, dir: -1 | 1, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, current + dir));
}

/** Tone position t ∈ [0,1] → x in viewBox units. */
export const tToX = (t: number, g: PlotGeom = PLOT): number =>
  g.pad + Math.min(1, Math.max(0, t)) * (g.w - 2 * g.pad);

/** x in viewBox units → tone position t, clamped to [0,1]. Inverse of tToX. */
export const xToT = (x: number, g: PlotGeom = PLOT): number => {
  const span = g.w - 2 * g.pad;
  return span <= 0 ? 0 : Math.min(1, Math.max(0, (x - g.pad) / span));
};

/** Channel value → y in viewBox units (max at the TOP, min at the bottom). */
export const vToY = (v: number, r: Range, g: PlotGeom = PLOT): number => {
  const span = r.max - r.min;
  const f = span <= 0 ? 0 : (v - r.min) / span;
  return g.pad + (1 - Math.min(1, Math.max(0, f))) * (g.h - 2 * g.pad);
};

/** y in viewBox units → channel value, clamped to [min,max]. Inverse of vToY. */
export const yToV = (y: number, r: Range, g: PlotGeom = PLOT): number => {
  const inner = g.h - 2 * g.pad;
  const f = inner <= 0 ? 0 : (y - g.pad) / inner;
  const v = r.max - Math.min(1, Math.max(0, f)) * (r.max - r.min);
  return Math.min(r.max, Math.max(r.min, v));
};

/**
 * Index of the control point nearest (px, py) within `radius` viewBox units, or
 * -1. Ties resolve to the lower index. Pure - the drag start and any keyboard
 * pick both route through this so the hit region is defined in exactly one place.
 */
export function nearestPoint(
  points: readonly CurvePoint[], px: number, py: number, r: Range,
  radius: number, g: PlotGeom = PLOT,
): number {
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < points.length; i++) {
    const x = tToX(points[i]!.t, g);
    const y = vToY(points[i]!.v, r, g);
    const d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}

/** The C axis range for a curve - the fixed 0–0.4, widened to fit a curve whose
 *  chroma was pushed higher, so a saturated stop is never clipped off the plot. */
export function chromaRange(curve: ColorCurve): Range {
  let max = CHANNEL_RANGE.C.max;
  for (const p of curve.C.points) if (p.v > max) max = p.v;
  // Round up to a tidy tick so the axis label stays readable.
  return { min: 0, max: Math.ceil(max * 20) / 20 };
}

/** Ascending-t copy of a channel's points (for a stable polyline + strip). */
const ordered = (chan: ChannelCurve): CurvePoint[] =>
  [...chan.points].sort((a, b) => a.t - b.t);

const rangeFor = (channel: Channel, curve: ColorCurve): Range =>
  channel === 'C' ? chromaRange(curve) : CHANNEL_RANGE[channel];

const chanOf = (curve: ColorCurve, channel: Channel): ChannelCurve => curve[channel];

/** A human, compact readout of a channel value (L 0–1, C 0–0.4, H degrees). */
const fmtValue = (channel: Channel, v: number): string =>
  channel === 'H' ? `${Math.round(v)}°` : v.toFixed(channel === 'C' ? 3 : 3);

export interface CurveEditorOptions {
  curve: ColorCurve;
  steps: number;
  onChange: (curve: ColorCurve) => void;
}

export interface CurveEditorHandle {
  /** Repaint, optionally swapping in a new curve and/or step count (a ramp
   *  switch, the Shades slider, or a re-anchor all route through here). */
  render(patch?: { curve?: ColorCurve; steps?: number }): void;
  teardown(): void;
}

const CHANNELS: ReadonlyArray<{ id: Channel; label: string }> = [
  { id: 'L', label: 'L' }, { id: 'C', label: 'C' }, { id: 'H', label: 'H' },
];

/**
 * Mount the inline curve editor into `mount`. Drags mutate a working COPY of the
 * curve and emit it through `onChange`; the host owns persistence. Returns a
 * handle to re-render (on ramp switch / steps change / re-anchor) or tear down.
 */
export function mountCurveEditor(mount: HTMLElement, opts: CurveEditorOptions): CurveEditorHandle {
  // Working copy - never mutate the caller's curve object in place.
  let curve = cloneCurve(opts.curve);
  let steps = Math.max(1, Math.floor(opts.steps));
  let channel: Channel = 'L';
  let dragIndex = -1;
  // The point that carries the roving tabindex (0); every other point is -1, so
  // Tab lands on one point and ←/→ move focus between them (WAI-ARIA roving).
  let activeIndex = 0;
  let raf = 0;

  const g = PLOT;

  const emit = (): void => {
    // Coalesce rapid pointermove emits to one per frame - bakeCurve on the host
    // side (a live preview re-derive) is the expensive part, not the maths here.
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; opts.onChange(cloneCurve(curve)); });
  };

  const draw = (): void => {
    const r = rangeFor(channel, curve);
    const pts = ordered(chanOf(curve, channel));
    const line = pts.map(p => `${tToX(p.t, g).toFixed(2)},${vToY(p.v, r, g).toFixed(2)}`).join(' ');
    const raw = chanOf(curve, channel).points;
    const n = raw.length;
    if (activeIndex >= n) activeIndex = Math.max(0, n - 1);
    // Each point is an ARIA slider on the channel's axis; roving tabindex (0 on
    // the active point, -1 on the rest) makes Tab reach one and ←/→ move between.
    const dots = raw.map((p, i) =>
      `<circle class="be-curve-pt" data-i="${i}" role="slider" tabindex="${i === activeIndex ? 0 : -1}"
         aria-label="${escape(`${channel} point ${i + 1} of ${n}`)}"
         aria-valuemin="${r.min}" aria-valuemax="${r.max}" aria-valuenow="${p.v.toFixed(4)}" aria-valuetext="${escape(fmtValue(channel, p.v))}"
         cx="${tToX(p.t, g).toFixed(2)}" cy="${vToY(p.v, r, g).toFixed(2)}" r="4.5">
         <title>${escape(`t ${p.t.toFixed(2)} · ${channel} ${fmtValue(channel, p.v)}`)}</title>
       </circle>`).join('');
    // Faint gridlines at 0 / .5 / 1 of the axis range give the drag a frame.
    const grid = [0, 0.5, 1].map(f => {
      const y = g.pad + (1 - f) * (g.h - 2 * g.pad);
      return `<line class="be-curve-grid" x1="${g.pad}" y1="${y.toFixed(2)}" x2="${(g.w - g.pad).toFixed(2)}" y2="${y.toFixed(2)}"/>`;
    }).join('');
    const strip = bakeCurve(curve, steps)
      .map(hex => `<span class="be-curve-cell" style="background:${escape(hex)}"></span>`).join('');
    const toggle = CHANNELS.map(c =>
      `<button type="button" class="be-curve-ch${c.id === channel ? ' is-active' : ''}" data-ch="${c.id}"
         aria-pressed="${c.id === channel}" aria-label="${escape(channelTitle(c.id))}"
         title="${escape(channelTitle(c.id))}">${c.label}</button>`).join('');

    mount.innerHTML = `
      <div class="be-curve-toolbar" role="group" aria-label="${escape('Curve channel')}">${toggle}
        <span class="be-curve-axis">${escape(axisLabel(channel, r))}</span>
      </div>
      <svg class="be-curve-plot" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="none"
           role="group" aria-label="${escape(`${channel} tonal curve - drag a point, or Tab to a point and use Arrow keys (←/→ switch points, Home/End for the extremes)`)}">
        ${grid}
        <polyline class="be-curve-line" points="${line}"/>
        ${dots}
      </svg>
      <div class="be-curve-strip" aria-hidden="true">${strip}</div>`;

    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    if (svg) svg.classList.toggle('is-animated', !prefersReducedMotion());
  };

  // ── Pointer drag (value-only; each control point stays at its tone position) ──
  const svgPoint = (ev: PointerEvent): { x: number; y: number } | null => {
    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((ev.clientX - rect.left) / rect.width) * g.w,
      y: ((ev.clientY - rect.top) / rect.height) * g.h,
    };
  };

  const onDown = (ev: PointerEvent): void => {
    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    if (!svg) return;
    const pt = svgPoint(ev);
    if (!pt) return;
    const r = rangeFor(channel, curve);
    const i = nearestPoint(chanOf(curve, channel).points, pt.x, pt.y, r, 16, g);
    if (i < 0) return;
    dragIndex = i;
    activeIndex = i; // keyboard focus follows the last-grabbed point (settled on onUp's draw)
    svg.setPointerCapture(ev.pointerId);
    svg.classList.add('is-dragging');
    ev.preventDefault();
  };

  const onMove = (ev: PointerEvent): void => {
    if (dragIndex < 0) return;
    const pt = svgPoint(ev);
    if (!pt) return;
    const r = rangeFor(channel, curve);
    const chan = chanOf(curve, channel);
    const p = chan.points[dragIndex];
    if (!p) return;
    p.v = yToV(pt.y, r, g); // value-only - tone position (t) is fixed
    // Live: nudge just the dragged circle + the polyline + the strip, not a full
    // innerHTML (which would drop the pointer capture mid-drag).
    updateLive();
    emit();
  };

  const onUp = (ev: PointerEvent): void => {
    if (dragIndex < 0) return;
    dragIndex = -1;
    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    svg?.classList.remove('is-dragging');
    try { svg?.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
    draw();          // settle: re-order the polyline + rebuild titles cleanly
    opts.onChange(cloneCurve(curve));
  };

  /** In-place refresh of the dragged channel's dots, polyline and swatch strip - 
   *  the fast path during a drag (no innerHTML, so pointer capture survives). */
  const updateLive = (): void => {
    const r = rangeFor(channel, curve);
    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    if (!svg) return;
    const pts = chanOf(curve, channel).points;
    svg.querySelectorAll<SVGCircleElement>('.be-curve-pt').forEach(c => {
      const i = Number(c.dataset.i);
      const p = pts[i];
      if (p) { c.setAttribute('cx', tToX(p.t, g).toFixed(2)); c.setAttribute('cy', vToY(p.v, r, g).toFixed(2)); }
    });
    const poly = svg.querySelector<SVGPolylineElement>('.be-curve-line');
    if (poly) poly.setAttribute('points', ordered(chanOf(curve, channel))
      .map(p => `${tToX(p.t, g).toFixed(2)},${vToY(p.v, r, g).toFixed(2)}`).join(' '));
    const cells = mount.querySelectorAll<HTMLElement>('.be-curve-cell');
    const baked = bakeCurve(curve, steps);
    cells.forEach((cell, i) => { if (baked[i]) cell.style.background = baked[i]!; });
  };

  const onToolbarClick = (ev: MouseEvent): void => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-ch]');
    if (!btn) return;
    const ch = btn.dataset.ch as Channel;
    if (ch === channel) return;
    channel = ch;
    draw();
  };

  // ── Keyboard operability (roving-tabindex ARIA sliders) ─────────────────────
  /** Move the roving tabindex + DOM focus to point `i` (clamped) without a full
   *  redraw - just re-stamps tabindex and focuses, so ←/→ stay snappy. */
  const setActive = (i: number): void => {
    const svg = mount.querySelector<SVGSVGElement>('.be-curve-plot');
    if (!svg) return;
    activeIndex = Math.min(chanOf(curve, channel).points.length - 1, Math.max(0, i));
    svg.querySelectorAll<SVGCircleElement>('.be-curve-pt').forEach(c =>
      c.setAttribute('tabindex', Number(c.dataset.i) === activeIndex ? '0' : '-1'));
    svg.querySelector<SVGElement>(`.be-curve-pt[data-i="${activeIndex}"]`)?.focus();
  };

  const onKeyPoint = (ev: KeyboardEvent): void => {
    const circle = (ev.target as Element | null)?.closest?.('.be-curve-pt') as SVGElement | null;
    if (!circle) return;
    const i = Number(circle.getAttribute('data-i'));
    const pts = chanOf(curve, channel).points;
    if (!Number.isInteger(i) || i < 0 || i >= pts.length) return;
    // ←/→ move focus between points (roving tabindex).
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      setActive(rovingIndex(i, ev.key === 'ArrowLeft' ? -1 : 1, pts.length));
      return;
    }
    // Up/Down step the VALUE (Shift = coarse), Home/End jump to the axis extremes - 
    // all clamped to the channel range, mutating the working copy and emitting the
    // same onChange the pointer drag does.
    const r = rangeFor(channel, curve);
    const p = pts[i];
    if (!p) return;
    let v: number | null = null;
    if (ev.key === 'ArrowUp') v = stepPointValue(p.v, channel, 1, ev.shiftKey, r);
    else if (ev.key === 'ArrowDown') v = stepPointValue(p.v, channel, -1, ev.shiftKey, r);
    else if (ev.key === 'Home') v = r.min;
    else if (ev.key === 'End') v = r.max;
    else return;
    ev.preventDefault();
    p.v = v;
    activeIndex = i;
    draw(); // settle: aria-valuenow/valuetext, titles, polyline, strip + roving tabindex
    mount.querySelector<SVGElement>(`.be-curve-pt[data-i="${i}"]`)?.focus();
    opts.onChange(cloneCurve(curve));
  };

  // One delegated listener per gesture, bound to the mount (survives every draw).
  mount.addEventListener('pointerdown', onDown);
  mount.addEventListener('pointermove', onMove);
  mount.addEventListener('pointerup', onUp);
  mount.addEventListener('pointercancel', onUp);
  mount.addEventListener('click', onToolbarClick);
  mount.addEventListener('keydown', onKeyPoint);

  draw();

  return {
    render(patch) {
      if (patch?.curve) curve = cloneCurve(patch.curve);
      if (patch?.steps != null) steps = Math.max(1, Math.floor(patch.steps));
      draw();
    },
    teardown() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      mount.removeEventListener('pointerdown', onDown);
      mount.removeEventListener('pointermove', onMove);
      mount.removeEventListener('pointerup', onUp);
      mount.removeEventListener('pointercancel', onUp);
      mount.removeEventListener('click', onToolbarClick);
      mount.removeEventListener('keydown', onKeyPoint);
      mount.innerHTML = '';
    },
  };
}

// ── Small pure helpers ────────────────────────────────────────────────────────

/** A deep copy of a curve - the editor never mutates the caller's object. */
export function cloneCurve(curve: ColorCurve): ColorCurve {
  const chan = (c: ChannelCurve): ChannelCurve => ({ points: c.points.map(p => ({ t: p.t, v: p.v })) });
  return { L: chan(curve.L), C: chan(curve.C), H: chan(curve.H) };
}

const channelTitle = (ch: Channel): string =>
  ch === 'L' ? 'Lightness (L)' : ch === 'C' ? 'Chroma (C)' : 'Hue (H)';

const axisLabel = (ch: Channel, r: Range): string =>
  ch === 'H' ? '0–360°' : `${r.min}–${r.max}`;

/** The colours a curve currently bakes to (host convenience; also the strip). */
export function bakedStrip(curve: ColorCurve, steps: number): string[] {
  return bakeCurve(curve, Math.max(1, Math.floor(steps)));
}

/** The oklch() literals a curve bakes to at `steps` - the exact form the doc's
 *  step tokens carry (formatOklch), handy for host-side assertions. */
export function curveLiterals(curve: ColorCurve, steps: number): string[] {
  return sampleCurve(curve, Math.max(1, Math.floor(steps))).map(formatOklch);
}
