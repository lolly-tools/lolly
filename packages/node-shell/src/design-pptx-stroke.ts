// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke position and per-side widths on the native PowerPoint deck.
 *
 * PowerPoint draws a shape's line centred on its edge, one width all round. So a
 * rectangle-like layer whose stroke Design places elsewhere is lowered as the nearest
 * thing PowerPoint draws, the same choices the deck model makes in the Design renderer
 * (`deckStrokeBand`):
 *
 * - a centred stroke is exactly PowerPoint's line, and an inside stroke keeps the centred
 *   line older exports wrote, so neither changes;
 * - an outside stroke grows the shape by half the width, so the centred line is drawn
 *   outside the box;
 * - per-side widths travel as a separate custom-geometry shape, the ring between the
 *   stroke's outer and inner edges filled with the stroke colour, over a shape without a line.
 */
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { EMU_PER_PX, type PptxPath } from '../../../engine/src/pptx.ts';
import { designStrokeAlign, designStrokeSides, designStrokeSidesApply, strokeOutFraction, strokeRing, strokeRingContours, strokeSidesEqual, type DesignStrokeAlign, type DesignStrokeSides } from '../../../engine/src/design-stroke.ts';
import { toSvgPathData, type Contour } from '../../../engine/src/geom/path.ts';

const text = (row: DesignBoxRowV1, key: string): string => (row[key] == null ? '' : String(row[key]));
const value = (row: DesignBoxRowV1, key: string, fallback = 0): number => {
  const n = Number.parseFloat(text(row, key));
  return Number.isFinite(n) ? n : fallback;
};

/** How a layer's stroke is lowered: the row to lower in its place, and the ring to add over that row. */
export interface DeckStrokePlan { row: DesignBoxRowV1; band?: { sides: DesignStrokeSides; align: DesignStrokeAlign } }

/**
 * A row field read through its own data descriptor, never through a getter, a proxy's
 * `get` or the prototype: the native lowering promises the same property reads, in the
 * same order, as the producer it replaced, so the two new fields are looked up without
 * a read of their own. A field that is an accessor, inherited or unreadable is absent.
 */
function own(row: DesignBoxRowV1, key: string): unknown {
  try {
    const d = Object.getOwnPropertyDescriptor(row, key);
    return d && 'value' in d ? d.value : undefined;
  } catch { return undefined; }
}
const PLACEMENT = ['strokeAlign', 'strokeTop', 'strokeRight', 'strokeBottom', 'strokeLeft'] as const;

/** The plan for a rectangle-like layer whose stroke PowerPoint cannot draw where Design does; null when PowerPoint's own line is already right. */
export function deckStrokePlan(row: DesignBoxRowV1): DeckStrokePlan | null {
  // A row that sets neither field lowers exactly as it always has, with no read made here.
  if (!PLACEMENT.some((key) => String(own(row, key) ?? '').trim() !== '')) return null;
  const facts: DesignBoxRowV1 = {};
  for (const key of ['kind', 'shape', 'stroke', 'strokeW', ...PLACEMENT]) { const v = own(row, key); if (v !== undefined) facts[key] = v as DesignBoxRowV1[string]; }
  const kind = text(facts, 'kind');
  if (kind !== '' && kind !== 'box') return null;
  if (!text(facts, 'stroke').trim()) return null;
  const sides = designStrokeSidesApply(facts) ? designStrokeSides(facts) : null;
  const align = designStrokeAlign(facts);
  const plain: DesignBoxRowV1 = { ...row, strokeAlign: '', strokeTop: '', strokeRight: '', strokeBottom: '', strokeLeft: '' };
  if (sides && !strokeSidesEqual(sides) && Math.max(...sides) > 0) return { row: { ...plain, strokeW: 0 }, band: { sides, align } };
  const width = sides ? sides[0] : value(facts, 'strokeW');
  if (align !== 'outside' || !(width > 0)) return null;
  const half = width / 2, shape = text(row, 'shape');
  return { row: {
    ...plain, strokeW: width,
    x: value(row, 'x') - half, y: value(row, 'y') - half, w: value(row, 'w', 1) + width, h: value(row, 'h', 1) + width,
    ...(shape === 'rounded' && value(row, 'radius') > 0 ? { radius: value(row, 'radius') + half } : {}),
  } };
}

const scaled = (contours: Contour[]): Contour[] => contours.map((c) => ({ closed: c.closed, curves: c.curves.map((q) => q.map((v) => v * EMU_PER_PX) as typeof q) }));

/**
 * The ring a per-side stroke paints, as a custom-geometry shape filled with the stroke
 * colour. Its frame is the layer's box grown evenly by the widest outside reach, so the
 * shape turns about the layer's own centre; a mirrored layer swaps the sides it turns over.
 */
export function deckStrokeBand(row: DesignBoxRowV1, band: NonNullable<DeckStrokePlan['band']>, origin: { x: number; y: number }, colour: string, alpha?: number): PptxPath {
  const w = Math.max(1, value(row, 'w', 1)), h = Math.max(1, value(row, 'h', 1));
  let [t, r, b, l] = band.sides.map((v) => Math.max(0, v)) as DesignStrokeSides;
  if (row.flipH === true || text(row, 'flipH') === 'true') [l, r] = [r, l];
  if (row.flipV === true || text(row, 'flipV') === 'true') [t, b] = [b, t];
  const m = Math.max(t, r, b, l) * strokeOutFraction(band.align), shape = text(row, 'shape');
  const radius = shape === 'pill' ? Math.min(w, h) / 2 : shape === 'rounded' ? Math.min(Math.max(0, value(row, 'radius')), w / 2, h / 2) : 0;
  const ring = strokeRing({ x: m, y: m, w, h }, { kind: 'rect', radius }, band.align, [t, r, b, l]);
  const rot = value(row, 'rot');
  return {
    kind: 'path',
    x: Math.round((value(row, 'x') - origin.x - m) * EMU_PER_PX), y: Math.round((value(row, 'y') - origin.y - m) * EMU_PER_PX),
    cx: Math.max(1, Math.round((w + 2 * m) * EMU_PER_PX)), cy: Math.max(1, Math.round((h + 2 * m) * EMU_PER_PX)),
    ...(rot !== 0 ? { rot } : {}),
    fill: { solid: colour, ...(alpha !== undefined ? { alpha } : {}) },
    paths: [{ d: toSvgPathData(scaled(strokeRingContours(ring)), 0) }],
  };
}
