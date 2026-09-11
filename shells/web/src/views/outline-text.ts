// SPDX-License-Identifier: MPL-2.0
/**
 * Outline text - convert a rendered text box's glyphs into real vector path
 * geometry, in place (plan 88: the Font Outliner capability exposed inside the
 * freeform editors, not a standalone tool only).
 *
 * This reuses the exact machinery the SVG/PDF export walk uses to outline text
 * at export time (shells/web/src/bridge/export.ts emitInlineTextSvg): per-text-
 * node computed styles, per-visual-line Range rects (visualLines), CSS half-
 * leading baseline math (textBaselineY), family→font-file resolution with
 * fallback chains (resolveVectorFont) and HarfBuzz shaping (host.text.toPath).
 * The difference is where the result goes: the export walk emits SVG once per
 * export; this bakes the outlines into the box model as ordinary kind:'path'
 * boxes (the engine authored-spline codec via vector-ops' pathToBox), so the
 * text becomes durable vector geometry that renders headlessly (CLI/URL mode)
 * and survives share links - unlike an SVG data URI or a user asset, which the
 * compact block URL encoding cannot carry.
 *
 * Two phases, deliberately split:
 *  - COLLECT (sync): measure the live DOM. The caller neutralises the box's
 *    rotation/transition transform around this call so Range rects are axis-
 *    aligned layout geometry, and maps every rect client→native so stage
 *    zoom/fit scale never leaks in here. Computed styles are copied into plain
 *    RunStyle records during the walk (getComputedStyle objects are live views
 *    that would read post-restore values once shaping awaits).
 *  - SHAPE (async): resolve fonts, shape per line, group contours by fill.
 *
 * Refusal-first: a run that cannot be outlined faithfully (no resolvable font
 * file, or glyphs the resolved face chain cannot draw - notdef) refuses the
 * WHOLE element rather than committing tofu or a partial conversion. That is
 * the same stance the export walk takes, except an in-place edit has no
 * `<text>` fallback to keep, so refusal is the only honest answer.
 */
import { parseSvgPath, pathFromSubPaths } from '@lolly/engine';
import type { GeomPath } from '@lolly/engine';
import { visualLines, fontMetricsPx, decoFlags, mergeDeco, isReplaced, type Deco } from '../bridge/export.ts';
import {
  textBaselineY, letterSpacingPx, featureSettingsToHb, canVectoriseText, type FontStyleSlice,
} from '../bridge/text-svg.ts';
import { resolveVectorFont, type VectorFont } from '../bridge/font-registry.ts';
import { applyTextTransform } from '../bridge/export-pdf-vector.ts';
import { parseCssColorFull } from '../bridge/export-css.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

type TextApi = NonNullable<HostV1['text']>;

/** The computed properties one shaped run depends on, copied to plain data. */
export interface RunStyle {
  color: string;
  fontSize: number;           // native px (computed values ignore CSS transforms)
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  fontFeatureSettings: string;
  textTransform: string;
}

/** One visual line of one styled run, in NATIVE canvas px. */
export interface CollectedLine {
  text: string;
  x: number;
  top: number;
  width: number;
  height: number;
  deco: Deco;
  style: RunStyle;
}

/** Contours that share one fill - one kind:'path' box each, in run order. */
export interface OutlineGroup { fill: string; path: GeomPath }

export type OutlineRefusal = 'no-text' | 'no-font' | 'notdef' | 'empty' | 'not-visible';
export type OutlineOutcome =
  | { ok: true; groups: OutlineGroup[] }
  | { ok: false; reason: OutlineRefusal };

export type RectToNative = (r: DOMRect) => { x: number; y: number; w: number; h: number };

/** Injectable seams for the DOM-free unit tests; production callers omit them. */
export interface ShapeDeps {
  resolveFont?: (style: FontStyleSlice, text: string) => Promise<VectorFont | null>;
  metricsFor?: (style: RunStyle, fontSizePx: number) => { ascent: number; descent: number };
}

/**
 * Walk a text block exactly like the export walkers do - text nodes split on
 * explicit '\n' then on soft wraps, descending only into non-replaced inline
 * elements (anything with its own box is separate content, not this block's
 * text), text-decoration OR'd down the tree - and return one CollectedLine per
 * visual line per styled run. Sync on purpose: see the module header.
 */
export function collectTextLines(textEl: HTMLElement, rectToNative: RectToNative): CollectedLine[] {
  const out: CollectedLine[] = [];
  const walk = (node: Node, style: CSSStyleDeclaration, deco: Deco): void => {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text || !text.trim()) return;
      const run: RunStyle = {
        color: style.color,
        fontSize: parseFloat(style.fontSize) || 16,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        letterSpacing: style.letterSpacing,
        fontFeatureSettings: style.fontFeatureSettings,
        textTransform: style.textTransform,
      };
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            if (line.rect.width > 0.5 && line.rect.height > 0.5) {
              const r = rectToNative(line.rect);
              out.push({ text: line.text, x: r.x, top: r.y, width: r.w, height: r.h, deco, style: run });
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }
    } else if (node.nodeType === 1) {
      const el = node as Element;
      if (el.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(el);
      if (s.display === 'none') return;
      if (s.display !== 'inline' || isReplaced(el)) return;
      const cd = mergeDeco(deco, decoFlags(s));
      for (const child of el.childNodes) walk(child, s, cd);
    }
  };
  const rootStyle = window.getComputedStyle(textEl);
  for (const child of textEl.childNodes) walk(child, rootStyle, decoFlags(rootStyle));
  return out;
}

/** Translate every control point of every contour by (dx, dy). Exact: an affine
 *  map of cubic control points is an affine map of the curve. */
export function translateContours(path: GeomPath, dx: number, dy: number): GeomPath {
  return path.map((c) => ({
    closed: c.closed,
    curves: c.curves.map((cv) =>
      [cv[0] + dx, cv[1] + dy, cv[2] + dx, cv[3] + dy, cv[4] + dx, cv[5] + dy, cv[6] + dx, cv[7] + dy] as typeof cv),
  }));
}

/** An axis-aligned filled rect as contours - underline/strikethrough bars, the
 *  same geometry the export walk draws for text-decoration. */
export function rectContours(x: number, y: number, w: number, h: number): GeomPath {
  return pathFromSubPaths(parseSvgPath(`M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`));
}

/** A contour's horizontal extent (min/max x over every control point). */
function contourXSpan(c: GeomPath[number]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const cv of c.curves) for (let i = 0; i < 8; i += 2) { if (cv[i]! < lo) lo = cv[i]!; if (cv[i]! > hi) hi = cv[i]!; }
  return [lo, hi];
}

/**
 * Split a run's contours into one GeomPath per glyph, so each becomes its own path
 * box (the "separate objects, grouped" model). The signal is HORIZONTAL OVERLAP: a
 * glyph's counter (the hole in e/a/o/p) sits inside its outline's x-span, and a dot
 * sits directly above its stem, so both overlap and stay with their glyph - which is
 * required for the hole to render (a counter must share a box with its outline so the
 * nonzero winding cuts it out, exactly as `shapeCollectedLines` keeps deco bars apart
 * for the same reason). Side-by-side letters have a kerning gap, so their x-spans are
 * disjoint and they split. Tightly-kerned or overlapping letters (script faces, some
 * italics) may merge into one box - acceptable, and still renders correctly. Union-find
 * over pairwise overlap makes the grouping transitive; clusters come back left-to-right.
 */
export function clusterContoursByGlyph(path: GeomPath): GeomPath[] {
  const n = path.length;
  if (n <= 1) return n ? [path] : [];
  const span = path.map(contourXSpan);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Strict overlap: touching-but-adjacent spans (a hairline kerning meet) stay apart;
      // a real overlap (a counter inside its outline, a dot over its stem) merges.
      if (span[i]![0] < span[j]![1] && span[j]![0] < span[i]![1]) {
        const ri = find(i), rj = find(j);
        if (ri !== rj) parent[ri] = rj;
      }
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = byRoot.get(r);
    if (arr) arr.push(i); else byRoot.set(r, [i]);
  }
  return [...byRoot.values()]
    .map((idxs) => ({ idxs, minX: Math.min(...idxs.map((k) => span[k]![0])) }))
    .sort((a, b) => a.minX - b.minX)
    .map((cl) => cl.idxs.map((k) => path[k]!));
}

/** Computed CSS color → #rrggbb(aa) for a box fill field (hooks' safeColor
 *  accepts 3-8 digit hex; hex also stays compact on the block URL wire). */
export function cssColorToHex(color: string): string | null {
  const c = parseCssColorFull(color);
  if (!c) return null;
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}${c[3] >= 1 ? '' : h(c[3] * 255)}`;
}

/**
 * Rotating a frame rotates it about ITS OWN centre (CSS default transform
 * origin). A source box rotated about centre S paints a point at centre C of
 * the outline's tight bbox at R(S→C); a replacement frame centred on C spins
 * in place. This returns the frame shift that makes the replacement's rotated
 * centre land where the source rotation put it: shift = R(C−S) − (C−S).
 */
export function rotatedFrameShift(
  srcCx: number, srcCy: number, cx: number, cy: number, deg: number,
): { dx: number; dy: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const vx = cx - srcCx, vy = cy - srcCy;
  return { dx: vx * cos - vy * sin - vx, dy: vx * sin + vy * cos - vy };
}

/**
 * Shape collected lines into contour groups - ONE PER GLYPH, in reading order, so
 * each glyph becomes its own kind:'path' box that can be moved, recoloured and
 * node-edited on its own (the "separate objects, grouped" model - the caller groups
 * a source's boxes together). A glyph's counter stays with its outline in the same
 * group (see `clusterContoursByGlyph`), so the hole still renders.
 *
 * Group order is reading order: line order, then left-to-right within a line, then
 * any decoration bars last. Groups carry their run's fill, so a multi-colour run
 * (inline spans) keeps each glyph its own colour without a separate merge pass.
 */
export async function shapeCollectedLines(
  lines: CollectedLine[], textApi: TextApi, deps: ShapeDeps = {},
): Promise<OutlineOutcome> {
  const resolveFont = deps.resolveFont ?? ((s: FontStyleSlice, t: string) => resolveVectorFont(s, t));
  const metricsFor = deps.metricsFor
    ?? ((s: RunStyle, fs: number) => fontMetricsPx(s as unknown as CSSStyleDeclaration, fs));
  if (!lines.length) return { ok: false, reason: 'no-text' };

  // Glyph boxes are collected as an ORDERED list (reading order); decoration bars are
  // kept in SEPARATE per-fill groups (each its own box). A bar must not share a nonzero-
  // filled path with glyph outlines: the bar is a solid rect, the glyphs carry counters
  // via opposed winding, and a rect whose winding happens to oppose a glyph's outer
  // contour (CFF/PostScript-flavoured OTF fonts, which a user can upload) would punch a
  // hole where it crosses a stroke. The export walk draws each bar as an independent
  // <rect> for exactly this reason - we mirror that with a separate box.
  const glyphOut: OutlineGroup[] = [];
  const decoGroups = new Map<string, GeomPath>();
  const addDeco = (fill: string, contours: GeomPath): void => {
    if (!contours.length) return;
    const cur = decoGroups.get(fill);
    if (cur) cur.push(...contours);
    else decoGroups.set(fill, [...contours]);
  };

  for (const line of lines) {
    const text = applyTextTransform(line.text, line.style.textTransform);
    if (!text.trim()) continue;
    const slice: FontStyleSlice = {
      fontFamily: line.style.fontFamily,
      fontWeight: line.style.fontWeight,
      fontStyle: line.style.fontStyle,
    };
    const vf = await resolveFont(slice, text);
    if (!vf?.url || !canVectoriseText(slice, vf.url, true)) return { ok: false, reason: 'no-font' };

    const fontSize = line.style.fontSize;
    const res = await textApi.toPath({
      text,
      fontUrl: vf.url,
      fontSize,
      features: featureSettingsToHb(line.style.fontFeatureSettings) as string[],
      letterSpacing: letterSpacingPx(line.style.letterSpacing),
      variations: vf.variations,
      fallbackFonts: vf.fallbacks,
    });
    // Tofu is never an outline: if any glyph in the run is uncovered, refuse the
    // whole element (partial conversions read as data loss, not as a fallback).
    if ((res.notdef ?? 0) > 0) return { ok: false, reason: 'notdef' };

    const fill = cssColorToHex(line.style.color) ?? '#000000';
    const { ascent, descent } = metricsFor(line.style, fontSize);
    const by = textBaselineY(line.top, line.height, ascent, descent);
    if (res.d) {
      const all = translateContours(pathFromSubPaths(parseSvgPath(res.d)), line.x, by);
      for (const glyph of clusterContoursByGlyph(all)) if (glyph.length) glyphOut.push({ fill, path: glyph });
    }

    // Underline / strikethrough, same offsets and thickness as the export walk - 
    // into the DECO groups (see the note above), never merged with the glyph path.
    if (line.deco.u || line.deco.s) {
      const thick = Math.max(0.75, fontSize * 0.06);
      if (line.deco.u) addDeco(fill, rectContours(line.x, by + fontSize * 0.11 - thick / 2, line.width, thick));
      if (line.deco.s) addDeco(fill, rectContours(line.x, by - fontSize * 0.28 - thick / 2, line.width, thick));
    }
  }

  // Glyph boxes first (reading order), then any decoration boxes - so the bars stack
  // above the glyphs of the same run, matching the on-screen paint order.
  const out = [...glyphOut, ...[...decoGroups].map(([fill, path]) => ({ fill, path }))]
    .filter((g) => g.path.length > 0);
  if (!out.length) return { ok: false, reason: 'empty' };
  return { ok: true, groups: out };
}

/**
 * Outline one rendered box's text. Neutralises the box's transform for the
 * SYNCHRONOUS measurement so line rects are unrotated layout geometry (the caller
 * re-applies rotation on the result boxes), then shapes.
 *
 * The caller MUST have already awaited `document.fonts.ready` and a paint frame
 * before calling this - measuring here after an `await` is a bug: a font-load can
 * fire the template's fit pass mid-wait, moving the box under us so the captured
 * `boxEl` is stale and the geometry is wrong. This function stays await-free from
 * entry to the synchronous `collectTextLines`.
 */
export async function outlineBoxText(
  boxEl: HTMLElement, textEl: HTMLElement, textApi: TextApi, rectToNative: RectToNative, deps?: ShapeDeps,
): Promise<OutlineOutcome> {
  // A box that isn't laid out has no line geometry to read. The reachable case is
  // Sequence Studio's off-playhead clips (`.seq-off` → display:none): the sequence
  // "one rule" lets an off-playhead box stay selected, so this action can be invoked
  // on one. Report it distinctly so the caller can say "bring the clip on screen
  // first" rather than the generic "nothing to outline" (an honest, actionable
  // refusal - the same stance as the vector ops' empty-result message).
  if (!boxEl.getClientRects().length) return { ok: false, reason: 'not-visible' };
  const prev = boxEl.style.transform;
  boxEl.style.transform = 'none';
  void boxEl.offsetWidth; // reflow so the Range rects below are axis-aligned
  let lines: CollectedLine[];
  try {
    lines = collectTextLines(textEl, rectToNative);
  } finally {
    boxEl.style.transform = prev;
  }
  return shapeCollectedLines(lines, textApi, deps);
}
