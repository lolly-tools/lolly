// SPDX-License-Identifier: MPL-2.0
/** Word spacing moves clusters and source carets together without scaling glyph ink. */
import type { ShapedTextLine } from './text-paragraph.ts';
import { parseSvgPath } from './svg-path.ts';
const n = (value: number) => Math.round(value * 10000) / 10000;
export function transformTextPath(d: string, matrix: {a:number;b:number;c:number;d:number;e:number;f:number}): string {
  const at=(x:number,y:number)=>`${n(matrix.a*x+matrix.c*y+matrix.e)},${n(matrix.b*x+matrix.d*y+matrix.f)}`;
  return parseSvgPath(d).map(path=>path.segments.map(segment=>segment.op==='C'?`C${at(segment.x1,segment.y1)} ${at(segment.x2,segment.y2)} ${at(segment.x,segment.y)}`:`${segment.op}${at(segment.x,segment.y)}`).join('')+(path.closed?'Z':'')).join('');
}
export function translateTextPath(d: string, x: number, y = 0): string {
  if (!d || !x && !y) return d;
  return translateOutlinePath(d, x, y) ?? translateParsedPath(d, x, y);
}
/** The general route: any SVG path, normalised to absolute M, L and C. */
export function translateParsedPath(d: string, x: number, y: number): string {
  return parseSvgPath(d).map(path => path.segments.map(segment => segment.op === 'C'
    ? `C${n(segment.x1 + x)},${n(segment.y1 + y)} ${n(segment.x2 + x)},${n(segment.y2 + y)} ${n(segment.x + x)},${n(segment.y + y)}`
    : `${segment.op}${n(segment.x + x)},${n(segment.y + y)}`).join('') + (path.closed ? 'Z' : '')).join('');
}
/**
 * The hot route, for a path in the composer's own form: absolute M, L, C and Q with
 * `x,y` pairs (C three, Q two, pairs split by one space) and Z only before the next M.
 * Every shaped glyph outline (node-shell's textOutlinePixels, the web text bridge) and
 * every path this module writes has that form, and justified text shifts each glyph
 * after a widened space, so the general route's parse was most of a large document's
 * justification time.
 *
 * The output is exactly the general route's: the same numbers, the same rounding and
 * printing, Q made cubic with parseSvgPath's own arithmetic, and a subpath with no
 * segment (a lone M, closed or not) left out, as parseSvgPath leaves such a subpath out.
 * Anything outside the form, or longer than the parser's smallest budget allows for,
 * returns null and takes the general route.
 */
export function translateOutlinePath(d: string, x: number, y: number): string | null {
  if (d.length > 40_000) return null;
  let i = 0, out = '', sub = '', drawn = false, cx = 0, cy = 0, open = false;
  const flush = (): void => { if (drawn) out += sub; sub = ''; drawn = false; };
  // `-?digits(.digits)?`, read by hand: a sticky regex per number was half the route.
  const digits = (): boolean => {
    const from = i;
    for (let c = d.charCodeAt(i); c >= 48 && c <= 57; c = d.charCodeAt(++i));
    return i > from;
  };
  const num = (): number | null => {
    const from = i;
    if (d.charCodeAt(i) === 45) i++;
    if (!digits()) return null;
    if (d.charCodeAt(i) === 46) { i++; if (!digits()) return null; }
    return Number(d.slice(from, i));
  };
  const pair = (spaced: boolean): [number, number] | null => {
    if (spaced) { if (d.charCodeAt(i) !== 32) return null; i++; }
    const px = num(); if (px === null || d.charCodeAt(i) !== 44) return null; i++;
    const py = num(); return py === null ? null : [px, py];
  };
  const at = (px: number, py: number): string => `${n(px + x)},${n(py + y)}`;
  while (i < d.length) {
    const op = d[i++];
    if (op === 'M') {
      const p = pair(false); if (!p) return null;
      flush(); sub = `M${at(p[0], p[1])}`; cx = p[0]; cy = p[1]; open = true;
    } else if (!open) {
      return null;
    } else if (op === 'L') {
      const p = pair(false); if (!p) return null;
      sub += `L${at(p[0], p[1])}`; cx = p[0]; cy = p[1]; drawn = true;
    } else if (op === 'C') {
      const a = pair(false), b = a && pair(true), c = b && pair(true); if (!a || !b || !c) return null;
      sub += `C${at(a[0], a[1])} ${at(b[0], b[1])} ${at(c[0], c[1])}`; cx = c[0]; cy = c[1]; drawn = true;
    } else if (op === 'Q') {
      const q = pair(false), p = q && pair(true); if (!q || !p) return null;
      const x1 = cx + 2 / 3 * (q[0] - cx), y1 = cy + 2 / 3 * (q[1] - cy);
      const x2 = p[0] + 2 / 3 * (q[0] - p[0]), y2 = p[1] + 2 / 3 * (q[1] - p[1]);
      sub += `C${at(x1, y1)} ${at(x2, y2)} ${at(p[0], p[1])}`; cx = p[0]; cy = p[1]; drawn = true;
    } else if (op === 'Z') {
      sub += 'Z'; open = false;
    } else {
      return null;
    }
  }
  flush();
  return out;
}
export function textSpaceWidth(line: ShapedTextLine, source: string): number {
  return line.pieces.reduce((sum, piece) => sum + (piece.artwork?.whitespace?piece.advance:piece.shape?.clusters.reduce((sum, cluster) => sum + (/^[ \u00a0\u202f]+$/u.test(source.slice(cluster.start, cluster.end)) ? cluster.advance : 0), 0) ?? 0), 0);
}
/** factor multiplies the already settled word-space advances, including nonbreaking spaces. */
export function spaceTextLine(line: ShapedTextLine, source: string, factor: number): ShapedTextLine {
  if (Math.abs(factor - 1) < .000001) return line;
  let pen = 0;
  const pieces = line.pieces.map(piece => {
    const x = pen;
    if (!piece.shape) { const scale=piece.artwork?.whitespace?factor:1,advance=piece.advance*scale;pen += advance; return { ...piece, x,advance, carets: piece.carets.map(caret => ({ ...caret, x: n((caret.x - piece.x)*scale + x) })) }; }
    const visual = [...piece.shape.clusters].sort((a,b) => a.x-b.x), moved = new Map<number, typeof visual[number]>(); let delta = 0;
    for (const cluster of visual) {
      const extra = /^[ \u00a0\u202f]+$/u.test(source.slice(cluster.start, cluster.end)) ? cluster.advance * (factor - 1) : 0;
      moved.set(cluster.start, { ...cluster, x: n(cluster.x + delta), advance: n(cluster.advance + extra), d: translateTextPath(cluster.d, delta),
        carets: cluster.carets.map(caret => ({ ...caret, x: n(caret.x + delta + (cluster.advance ? (caret.x - cluster.x) / cluster.advance * extra : 0)) })) });
      delta += extra;
    }
    const advance = n(piece.advance + delta), shape = { ...piece.shape, advance, clusters: piece.shape.clusters.map(cluster => moved.get(cluster.start)!) };
    pen += advance;
    return { ...piece, x: n(x), advance, shape, carets: shape.clusters.flatMap(cluster => cluster.carets.map(caret => ({ ...caret, x: n(x + caret.x) }))) };
  });
  return { ...line, pieces, advance: n(pen + (line.hyphen?.shape.advance ?? 0)) };
}
