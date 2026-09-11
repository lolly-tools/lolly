// SPDX-License-Identifier: MPL-2.0
/**
 * CSS gradient -> SVG element builders (linear, radial, and the conic fan of
 * <polygon> wedges). A leaf: only engine colour/gradient parsing underneath, so
 * lib/component-background.ts can paint a component preview without importing the
 * whole export bridge.
 */
import { splitCssArgs, parseGradientAngle, expandGradientStops, parseGradientStop, parseColor, interpolateColor, colorToSrgb8, parseRadialGradient } from '@lolly/engine';
import type { ConicGradient } from '@lolly/engine';
import { n2 } from './export-css.ts';

// Builds a <linearGradient> SVG element from a CSS linear-gradient() value.
// Uses gradientUnits="userSpaceOnUse" so coordinates match the canvas space.
// Returns null if the value is not a parseable linear gradient.
export function buildLinearGradientEl(NS: string, bgImage: string, elX: number, elY: number, elW: number, elH: number, uid: number): Element | null {
  // ONE layer only. `.+` is greedy, so a two-layer `linear-gradient(…), linear-gradient(…)`
  // otherwise matches as a single gradient and both stop lists are concatenated into one
  // element - offsets restart mid-list and SVG clamps them, so the second layer's colours
  // smear over the first. Callers split the layer list and emit one element per layer.
  if (splitCssArgs(bgImage).length > 1) return null;
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]!);
  if (parts.length < 2) return null;

  let angleRad = Math.PI; // default: to bottom
  let stopsStart = 0;
  const first = parts[0]!.trim();
  if (/^to\s|deg$|turn$|rad$|grad$/.test(first)) {
    angleRad  = parseGradientAngle(first);
    stopsStart = 1;
  }

  const stops = parts.slice(stopsStart);
  if (stops.length < 2) return null;

  // Gradient line through the element centre; length guarantees full coverage
  // at any angle via: |w·sin(A)| + |h·cos(A)| / 2.
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const cx   = elX + elW / 2;
  const cy   = elY + elH / 2;
  const len  = (Math.abs(elW * sinA) + Math.abs(elH * cosA)) / 2;

  const grad = document.createElementNS(NS, 'linearGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', String(cx - sinA * len));
  grad.setAttribute('y1', String(cy + cosA * len));
  grad.setAttribute('x2', String(cx + sinA * len));
  grad.setAttribute('y2', String(cy - cosA * len));

  const n = stops.length;
  const parsedStops = expandGradientStops(
    stops.map((raw: string, i: number) => parseGradientStop(raw.trim(), i, n)).filter((st) => st.colorStr));
  parsedStops.forEach(({ colorStr, opacity, offset }) => {
    const s = document.createElementNS(NS, 'stop');
    // An absolute CSS stop position is a distance ALONG THE GRADIENT LINE, whose
    // full length is 2*len. <stop offset> takes a number 0-1 or a percentage, so a
    // raw "25px" is INVALID SVG: resvg discards it outright (measured - both stops
    // of a two-stop strip collapse to the last colour), and the rendering drifts
    // badly from the browser's (mean channel error up to 133 on a 3-stop gradient,
    // 99.8% of pixels wrong; 0.02 once converted). parseRadialGradient's stop loop
    // has always divided by rx for exactly this reason - this is the linear analogue.
    s.setAttribute('offset', offset.endsWith('px') && len > 0
      ? `${n2(parseFloat(offset) / (2 * len) * 100)}%`
      : offset);
    s.setAttribute('stop-color', colorStr!);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  });

  return grad.childNodes.length >= 2 ? grad : null;
}

// Builds a <radialGradient> SVG element from a CSS radial-gradient() value. Geometry
// (centre + rx/ry in box px) + stops come from the engine's parseRadialGradient; here we
// only assemble the SVG. An ellipse (rx≠ry) is emitted as a circle of radius rx with a
// y-scale gradientTransform about the centre. gradientUnits="userSpaceOnUse" so coords
// match the canvas. Returns null if the value isn't a parseable radial gradient.
/**
 * A conic gradient as a fan of wedges.
 *
 * Each wedge is a solid-filled pie slice between two angles, its colour sampled from
 * the stop list at the wedge's midpoint. Enough wedges and the banding is below the
 * threshold anyone can see; the count scales with the box so a small dial doesn't pay
 * for a page background's smoothness.
 *
 * The radius reaches the FARTHEST corner from the centre - a conic gradient covers
 * the whole box even when its centre is off to one side, and using half the diagonal
 * would leave an unpainted crescent.
 *
 * CSS measures the angle clockwise from 12 o'clock; SVG's coordinate zero is at 3
 * o'clock. The −90° here is that difference, and dropping it rotates every gradient
 * on the page by a quarter turn.
 */
export function conicFanEl(NS: string, cg: ConicGradient, x: number, y: number, w: number, h: number, gid: number): Element | null {
  const cx = x + cg.cx, cy = y + cg.cy;
  const R = Math.max(
    Math.hypot(cg.cx, cg.cy), Math.hypot(w - cg.cx, cg.cy),
    Math.hypot(cg.cx, h - cg.cy), Math.hypot(w - cg.cx, h - cg.cy),
  );
  if (!(R > 0) || !Number.isFinite(R)) return null;

  // Stops as fractions of the sweep, in order, with any unpositioned ones already
  // spread evenly by parseGradientStop.
  const raw = cg.stops
    .map((st) => ({
      col: st.colorStr!, op: st.opacity,
      at: parseFloat(st.offset) / (st.offset.endsWith('%') ? 100 : 360),
      // Parsed once per stop, not once per sampled wedge (this fan is up to 360 of them).
      // parseGradientStop returns an OPAQUE colorStr with the alpha split into
      // `opacity` - re-parsing the hex alone read `transparent` as opaque black,
      // which painted the checkerboard idiom's clear wedges solid. Restore it.
      cc: (() => { const c = parseColor(st.colorStr!); return c ? { ...c, alpha: st.opacity } : null; })(),
    }))
    .filter((st) => Number.isFinite(st.at));
  if (raw.length < 2) return null;
  // CSS gradient stop fixup: an offset smaller than the one before it is CLAMPED up
  // to it, which is how a hard-edged stop is written (`red 0 25%, blue 0 50%`).
  // Sorting instead would silently reorder those into a smooth ramp - and the
  // checkerboard behind every tool canvas is exactly that idiom.
  const stops = raw.map((st, i, all) => ({ ...st, at: i ? Math.max(st.at, all[i - 1]!.at) : st.at }));
  for (let i = 1; i < stops.length; i++) stops[i]!.at = Math.max(stops[i]!.at, stops[i - 1]!.at);

  // A repeating gradient's stop list is ONE period that tiles around the circle.
  const first = stops[0]!.at, last = stops[stops.length - 1]!.at;
  const period = cg.repeating && last > first ? last - first : 0;

  const sample = (tRaw: number): { col: string; op: number } => {
    const t = period ? first + (((tRaw - first) % period) + period) % period : tRaw;
    if (t <= stops[0]!.at) return stops[0]!;
    const last = stops[stops.length - 1]!;
    if (t >= last.at) return last;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1]!, b = stops[i]!;
      if (t <= b.at) {
        const span = b.at - a.at;
        const f = span > 0 ? (t - a.at) / span : 0;
        if (!a.cc || !b.cc) return f < 0.5 ? a : b;
        // sRGB interpolation, PREMULTIPLIED - matching what the browser paints for
        // the same conic (CSS Color 4 section 12.3). Lerping the channels raw instead drags
        // a `red → transparent` sweep through dark red at 50% instead of holding red
        // and fading it, so the exported fan disagreed with the screen. The engine
        // owns the maths (one interpolator for every format).
        const mixed = interpolateColor(a.cc, b.cc, f, { space: 'srgb' });
        const [r, g, bl, al] = colorToSrgb8(mixed);
        // Alpha rides on fill-opacity below, so the fill itself is the opaque colour.
        return { col: `rgb(${r},${g},${bl})`, op: al };
      }
    }
    return last;
  };

  const g = document.createElementNS(NS, 'g');
  const base = cg.fromRad - Math.PI / 2;
  /** One wedge from sweep fraction `t0` to `t1`, in the gradient's own angular space. */
  const wedge = (t0: number, t1: number, col: string, op: number): void => {
    const a0 = base + t0 * 2 * Math.PI;
    // Overlap into the next wedge by a hair: exact shared edges leave a visible seam of
    // background colour where two antialiased edges meet.
    const a1 = base + t1 * 2 * Math.PI + 0.004;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d',
      `M${n2(cx)} ${n2(cy)}L${n2(cx + R * Math.cos(a0))} ${n2(cy + R * Math.sin(a0))}` +
      `A${n2(R)} ${n2(R)} 0 ${t1 - t0 > 0.5 ? 1 : 0} 1 ${n2(cx + R * Math.cos(a1))} ${n2(cy + R * Math.sin(a1))}Z`);
    p.setAttribute('fill', col);
    if (op < 1) p.setAttribute('fill-opacity', String(Math.round(op * 1000) / 1000));
    p.setAttribute('shape-rendering', 'crispEdges');
    g.appendChild(p);
  };

  // ── hard-stop fast path: EXACT sectors, not sampled wedges ──────────────────
  // A conic built entirely of constant-colour bands (`A 0 25%, B 0 50%` - the
  // checkerboard idiom) has a precise vector form: one path per band, boundaries on the
  // stop angles. Sampling it as a uniform fan instead puts wedge edges WHERE THE COLOUR
  // DOES NOT CHANGE, and each of those edges carries the 0.004rad overlap above - which
  // is why a 14px checker tile came out with faint diagonal hairlines across every
  // square. Exact sectors also collapse ~48 paths to 2.
  const bands: { from: number; to: number; col: string; op: number }[] = [];
  let hardStopped = stops.length >= 2;
  for (let i = 1; i < stops.length && hardStopped; i++) {
    const a = stops[i - 1]!, b = stops[i]!;
    if (a.col === b.col && Math.abs(a.op - b.op) < 1e-6) {
      if (b.at - a.at > 1e-9) bands.push({ from: a.at, to: b.at, col: a.col, op: a.op });
    } else if (b.at - a.at > 1e-9) {
      hardStopped = false;                    // a genuine ramp between two colours
    }
  }
  if (hardStopped && bands.length) {
    // A repeating gradient's bands tile around the circle; a non-repeating one paints
    // its first and last colours out to the ends of the sweep (CSS Images 3 section 5.4).
    const emit = (from: number, to: number, col: string, op: number): void => {
      const lo = Math.max(0, from), hi = Math.min(1, to);
      if (hi - lo > 1e-9 && op > 0) wedge(lo, hi, col, op);   // a clear band paints nothing
    };
    if (period > 0) {
      for (let k = 0; first + k * period < 1 + period; k++) {
        for (const b of bands) emit(b.from + k * period, b.to + k * period, b.col, b.op);
      }
    } else {
      const head = stops[0]!, tail = stops[stops.length - 1]!;
      emit(0, first, head.col, head.op);
      for (const b of bands) emit(b.from, b.to, b.col, b.op);
      emit(last, 1, tail.col, tail.op);
    }
    void gid;
    return g.childNodes.length ? g : null;
  }

  // One wedge per ~1.5° at page scale, fewer for a small dial. Capped so a huge
  // element cannot emit thousands of paths.
  const n = Math.max(48, Math.min(360, Math.round(R / 2)));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const { col, op } = sample((t0 + t1) / 2);
    wedge(t0, t1, col, op);
  }
  void gid;
  return g;
}

export function buildRadialGradientEl(NS: string, bgImage: string, elX: number, elY: number, elW: number, elH: number, uid: number): Element | null {
  if (splitCssArgs(bgImage).length > 1) return null;   // one LAYER per element - see buildLinearGradientEl
  const g = parseRadialGradient(bgImage, elW, elH);
  if (!g) return null;
  const { rx, ry } = g;
  const CX = elX + g.cx, CY = elY + g.cy;
  const grad = document.createElementNS(NS, 'radialGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('cx', String(n2(CX)));
  grad.setAttribute('cy', String(n2(CY)));
  grad.setAttribute('r',  String(n2(rx)));
  if (Math.abs(rx - ry) > 0.01) {
    const sy = ry / rx;                            // scale y about CY: leaves cx/cy fixed
    grad.setAttribute('gradientTransform', `matrix(1,0,0,${n2(sy)},0,${n2(CY * (1 - sy))})`);
  }
  for (const { colorStr, opacity, offset } of g.stops) {
    const s = document.createElementNS(NS, 'stop');
    // A px stop offset is a distance along the radius → fraction of rx (SVG stops take
    // 0–1 / %); percentages pass through unchanged.
    s.setAttribute('offset', offset.endsWith('px') ? `${n2(parseFloat(offset) / rx * 100)}%` : offset);
    s.setAttribute('stop-color', colorStr!);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  }
  return grad.childNodes.length >= 2 ? grad : null;
}