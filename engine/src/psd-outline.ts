// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop vector outlines (psd-layer-semantics.ts `PsdSubpath`) made ready to
 * draw (plans/289): every combined outline turned the same way, overlapping
 * outlines merged into one when a stroke must run round the outside only, and the
 * outlines as SVG path data. Shared by the Design import (shells/web psd-import.ts)
 * and the Rebrand source reader (node-shell rebrand/source-psd.ts), so a Photoshop
 * shape is the same shape on both routes.
 */

import { selfUnion } from './geom/boolean.ts';
import type { GeomPath } from './geom/path.ts';
import type { PsdSubpath } from './psd-layer-semantics.ts';

/**
 * Photoshop's combine joins outlines into a union whichever way each was drawn. The
 * non-zero rule gives a union only when every outline turns the same way, so each
 * closed outline that turns the other way is reversed (knots in reverse order, with
 * their handles swapped).
 */
export function sameWinding(subpaths: readonly PsdSubpath[]): PsdSubpath[] {
  const area = (k: readonly PsdSubpath['knots'][number][]) =>
    k.reduce((a, p, i) => { const q = k[(i + 1) % k.length]!; return a + p.x * q.y - q.x * p.y; }, 0);
  return subpaths.map(sp => !sp.closed || area(sp.knots) >= 0 ? sp : {
    ...sp, knots: [...sp.knots].reverse().map(k => ({ x: k.x, y: k.y, inX: k.outX, inY: k.outY, outX: k.inX, outY: k.inY })),
  });
}

/**
 * Combined outlines as one outer outline, for a shape with a stroke: the non-zero
 * rule already fills the union, but a stroke on each outline would also draw the
 * edges where they overlap, which Photoshop does not. Null when the union is too
 * complex to work out within the geometry kernel's limits; the caller keeps the
 * separate outlines and says so.
 */
export function unionOutline(subpaths: readonly PsdSubpath[]): PsdSubpath[] | null {
  const geom: GeomPath = subpaths.filter(sp => sp.closed && sp.knots.length >= 2).map(sp => ({
    closed: true,
    curves: sp.knots.map((k, i) => {
      const n = sp.knots[(i + 1) % sp.knots.length]!;
      return [k.x, k.y, k.outX, k.outY, n.inX, n.inY, n.x, n.y] as [number, number, number, number, number, number, number, number];
    }),
  }));
  let merged: GeomPath;
  try { merged = selfUnion(geom, { fillRule: 'nonzero' }); } catch { return null; }
  const r = (v: number) => Math.round(v * 100) / 100;
  const out = merged.filter(c => c.curves.length).map((c): PsdSubpath => {
    const curves = c.curves;
    const last = curves[curves.length - 1]!, first = curves[0]!;
    const shut = Math.hypot(last[6] - first[0], last[7] - first[1]) < 1e-6;
    const knots = curves.map((cv, i) => {
      const prev = i > 0 ? curves[i - 1]! : shut ? last : null;
      return { x: r(cv[0]), y: r(cv[1]), inX: r(prev ? prev[4] : cv[0]), inY: r(prev ? prev[5] : cv[1]), outX: r(cv[2]), outY: r(cv[3]) };
    });
    // An open end (the closing edge left implicit) is a knot of its own, joined by a straight line.
    if (!shut) knots.push({ x: r(last[6]), y: r(last[7]), inX: r(last[4]), inY: r(last[5]), outX: r(last[6]), outY: r(last[7]) });
    return { closed: true, op: 1, knots };
  });
  return out.length ? out : null;
}

/**
 * The outlines as absolute SVG path data in document pixels: one `M` per outline,
 * a cubic `C` per segment (a straight segment is a cubic whose handles sit on its
 * ends) and `Z` for a closed outline.
 */
export function psdPathData(subpaths: readonly PsdSubpath[]): string {
  const n = (v: number) => String(Math.round(v * 100) / 100);
  return subpaths.filter(sp => sp.knots.length >= 2).map((sp) => {
    const k = sp.knots;
    const parts = [`M${n(k[0]!.x)} ${n(k[0]!.y)}`];
    const segments = sp.closed ? k.length : k.length - 1;
    for (let i = 0; i < segments; i++) {
      const a = k[i]!, b = k[(i + 1) % k.length]!;
      parts.push(`C${n(a.outX)} ${n(a.outY)} ${n(b.inX)} ${n(b.inY)} ${n(b.x)} ${n(b.y)}`);
    }
    if (sp.closed) parts.push('Z');
    return parts.join('');
  }).join('');
}
