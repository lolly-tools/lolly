// SPDX-License-Identifier: MPL-2.0
/**
 * SVG path `d` tokenizer — pure, DOM-free, platform-agnostic.
 *
 * Turns an SVG path data string into normalized **absolute** subpaths whose only
 * segment ops are M / L / C / Z. Every shorthand is expanded: H/V → L, S/T →
 * reflected cubic/quadratic, Q/T → cubic, A → cubic beziers (SVG appendix F.6).
 * This is the single source of truth for path parsing, shared by the PDF emitter
 * (drawSvgPathToPdf is now a thin adapter over it) and the EMF emitter
 * (engine/src/emf.js). One tokenizer, many sinks — see plans/emf-support.md.
 *
 * Output:
 *   parseSvgPath(d) → Array<{ segments: Segment[], closed: boolean }>
 *   Segment =
 *     | { op:'M', x, y }
 *     | { op:'L', x, y }
 *     | { op:'C', x1,y1, x2,y2, x, y }   // all curves normalized to cubic
 *
 * Coordinates are in the path's own user space (no transform applied) — callers
 * map them into device/page space themselves. `closed` reflects an explicit Z.
 */

/** One normalized path segment: a move, a line, or a cubic bezier. */
export type PathSegment =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

/** One subpath: an M-led segment run plus whether an explicit Z closed it. */
export interface SubPath {
  segments: PathSegment[];
  closed: boolean;
}

/** One cubic bezier from an arc decomposition: [cp1x, cp1y, cp2x, cp2y, endX, endY]. */
export type ArcBezier = [number, number, number, number, number, number];

/** Extract the numeric arguments from one command's argument string. */
export function parseSvgPathArgs(str: string): number[] {
  const m = str.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  return m ? m.map(Number) : [];
}

/**
 * Parse an SVG `d` string into absolute M/L/C subpaths.
 *
 * Mirrors the command handling in the former drawSvgPathToPdf, including its
 * hard-won fixes: Z returns the current point to the subpath start (so a
 * following relative `m` is offset correctly), and the cubic/quadratic control
 * point is preserved across C/S and Q/T for smooth-curve reflection. See
 * Memory `svg-to-pdf-path-parser` for why those matter (mono-white wordmark).
 */
export function parseSvgPath(d: string): SubPath[] {
  const cmdRe = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  const subpaths: SubPath[] = [];
  let cur: SubPath | null = null; // current subpath being built
  let cx = 0, cy = 0;            // current point
  let sx = 0, sy = 0;           // current subpath start
  let lastCmd = '';
  let lastCpx = 0, lastCpy = 0;
  let m: RegExpExecArray | null;

  // Returns the new subpath so the caller assigns `cur` directly (the compiler
  // can't track an assignment made inside the closure).
  const open = (x: number, y: number): SubPath => {
    const sub: SubPath = { segments: [{ op: 'M', x, y }], closed: false };
    subpaths.push(sub);
    return sub;
  };
  const line = (x: number, y: number): void => { if (cur) cur.segments.push({ op: 'L', x, y }); };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): void => {
    if (cur) cur.segments.push({ op: 'C', x1, y1, x2, y2, x, y });
  };

  while ((m = cmdRe.exec(d)) !== null) {
    const cmd  = m[1] ?? '';
    const nums = parseSvgPathArgs(m[2] ?? '');
    const abs  = cmd === cmd.toUpperCase();
    const C    = cmd.toUpperCase();
    // In-bounds by each case's loop condition; ?? 0 only satisfies the compiler.
    const at   = (i: number): number => nums[i] ?? 0;
    const ax   = (i: number): number => abs ? at(i) : cx + at(i);
    const ay   = (i: number): number => abs ? at(i) : cy + at(i);

    switch (C) {
      case 'M':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          if (i === 0) { cur = open(x, y); sx = x; sy = y; }   // new subpath
          else line(x, y);                                // subsequent pairs are L
          cx = x; cy = y;
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          line(x, y); cx = x; cy = y;
        }
        break;
      case 'H':
        for (let i = 0; i < nums.length; i++) {
          cx = abs ? at(i) : cx + at(i);
          line(cx, cy);
        }
        break;
      case 'V':
        for (let i = 0; i < nums.length; i++) {
          cy = abs ? at(i) : cy + at(i);
          line(cx, cy);
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const x1 = ax(i),     y1 = ay(i + 1);
          const x2 = ax(i + 2), y2 = ay(i + 3);
          const x  = ax(i + 4), y  = ay(i + 5);
          cubic(x1, y1, x2, y2, x, y);
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const r1x = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cx - lastCpx : cx;
          const r1y = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cy - lastCpy : cy;
          const x2  = ax(i),     y2 = ay(i + 1);
          const x   = ax(i + 2), y  = ay(i + 3);
          cubic(r1x, r1y, x2, y2, x, y);
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const qx1 = ax(i), qy1 = ay(i + 1);
          const x   = ax(i + 2), y = ay(i + 3);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          cubic(x1, y1, x2, y2, x, y);
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'T':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const qx1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cx - lastCpx : cx;
          const qy1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cy - lastCpy : cy;
          const x   = ax(i), y = ay(i + 1);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          cubic(x1, y1, x2, y2, x, y);
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < nums.length; i += 7) {
          const rx = Math.abs(at(i));
          const ry = Math.abs(at(i + 1));
          const xRot = at(i + 2) * Math.PI / 180;
          const la   = at(i + 3) ? 1 : 0;
          const sw   = at(i + 4) ? 1 : 0;
          const x    = ax(i + 5), y = ay(i + 6);
          if (rx < 1e-6 || ry < 1e-6) {
            line(x, y);
          } else {
            for (const [bx1, by1, bx2, by2, bx, by] of svgArcToBeziers(cx, cy, rx, ry, xRot, la, sw, x, y)) {
              cubic(bx1, by1, bx2, by2, bx, by);
            }
          }
          cx = x; cy = y;
          lastCpx = cx; lastCpy = cy;
        }
        break;
      case 'Z':
        if (cur) cur.closed = true;
        // After closepath the current point returns to the subpath start, so a
        // following relative command is offset from there, not the last point.
        cx = sx; cy = sy;
        break;
    }

    lastCmd = C;
    // Preserve the stored control point after curve commands so the next smooth
    // command can reflect it; everything else collapses it to the current point.
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') { lastCpx = cx; lastCpy = cy; }
  }

  // Drop subpaths with no actual geometry (a lone M contributes nothing to a
  // fill or stroke).
  return subpaths.filter(s => s.segments.some(seg => seg.op === 'L' || seg.op === 'C'));
}

/**
 * Convert an SVG elliptical-arc command to cubic bezier segments.
 * Returns [cp1x, cp1y, cp2x, cp2y, endX, endY] per segment. SVG spec F.6.
 */
export function svgArcToBeziers(
  x1: number, y1: number,
  rx: number, ry: number,
  phi: number, fa: number, fs: number,
  x2: number, y2: number,
): ArcBezier[] {
  if (x1 === x2 && y1 === y2) return [];

  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p =  cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  let rx2 = rx * rx, ry2 = ry * ry;
  const x1p2 = x1p * x1p, y1p2 = y1p * y1p;
  const lam = x1p2 / rx2 + y1p2 / ry2;
  if (lam > 1) {
    const sl = Math.sqrt(lam);
    rx *= sl; ry *= sl; rx2 = rx * rx; ry2 = ry * ry;
  }

  const num  = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den  = rx2 * y1p2 + ry2 * x1p2;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(num / den);
  const cxp  =  coef * rx * y1p / ry;
  const cyp  = -coef * ry * x1p / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angV = (ux: number, uy: number, vx: number, vy: number): number => {
    const sign = (ux * vy - uy * vx) < 0 ? -1 : 1;
    const dot  = ux * vx + uy * vy;
    const len  = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
  };

  const theta1 = angV(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta   = angV((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dtheta > 0) dtheta -= 2 * Math.PI;
  if (fs  && dtheta < 0) dtheta += 2 * Math.PI;

  const n  = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const dt = dtheta / n;
  const results: ArcBezier[] = [];

  for (let i = 0; i < n; i++) {
    const t1 = theta1 + i * dt;
    const t2 = theta1 + (i + 1) * dt;
    const alpha = (4 / 3) * Math.tan(dt / 4);

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    const ep1x = cosP * (rx * cos1) - sinP * (ry * sin1) + cx;
    const ep1y = sinP * (rx * cos1) + cosP * (ry * sin1) + cy;
    const dp1x = cosP * (-rx * sin1) - sinP * (ry * cos1);
    const dp1y = sinP * (-rx * sin1) + cosP * (ry * cos1);
    const ep2x = cosP * (rx * cos2) - sinP * (ry * sin2) + cx;
    const ep2y = sinP * (rx * cos2) + cosP * (ry * sin2) + cy;
    const dp2x = cosP * (-rx * sin2) - sinP * (ry * cos2);
    const dp2y = sinP * (-rx * sin2) + cosP * (ry * cos2);

    results.push([
      ep1x + alpha * dp1x, ep1y + alpha * dp1y,
      ep2x - alpha * dp2x, ep2y - alpha * dp2y,
      ep2x, ep2y,
    ]);
  }

  return results;
}
