// SPDX-License-Identifier: MPL-2.0
/**
 * What the census reads from a drawing's items (plan 275 decision 32).
 *
 * A picture that stays a picture keeps its own colours and is measured from its
 * pixels. A drawing carried as items (`SourceObjectV1.vectorItems`, from an SVG
 * picture or a freeform's custom geometry) is not a raster, so the census reads
 * it the way it reads a shape: its fills by area, its strokes by length times
 * width, and the parts that state a series name as one distinction set, the same
 * guarantee a native chart's series already have. This module holds those
 * readings as plain functions over one source object, so the census calls them
 * where it measures features, collects colour uses and ranks class candidates:
 *
 *   - `vectorFeatures` gives the feature facts (`fillCount`, `hasText`,
 *     `seriesCount`) a drawing states;
 *   - `vectorColourUses` gives its colour uses, keyed and weighted the way the
 *     census keys and weighs every other use;
 *   - `vectorChartEvidence` says whether the drawing reads as a chart, with the
 *     evidence rows the review shows.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */

import type { EvidenceV1, SourceObjectV1, VectorItemV1, VectorPathItemV1 } from '@lolly-tools/core';

import { hexToOklch } from './brand-derive.ts';

/** Chroma at or above which a fill reads as a colour rather than a grey (the census's own accent floor). */
const INK_CHROMA_CEILING = 0.04;

/** A vector part this short, as a share of the drawing's height, is a glyph run (a label) when it is filled grey. */
const GLYPH_HEIGHT_SHARE = 0.12;

/** Axis-aligned bars sharing one edge at least this many times read as a chart's bars. */
const CHART_MIN_BARS = 3;

/** Distinct series names a chart states at least, beside its bars. */
const CHART_MIN_SERIES = 2;

/** Confidence a drawing reads as a chart with, from its own title or its bars. */
export const VECTOR_CHART_CONFIDENCE = 0.7;

/** Feature facts one drawing states. */
export interface VectorFeatureFactsV1 {
  /** Distinct fill colours among its parts. */
  fillCount: number;
  /** A part is set as text (a `<text>` element), not outlined. */
  hasText: boolean;
  /** Distinct series names its parts state. */
  seriesCount: number;
}

/**
 * The facts a drawing's items state, or undefined when the object carries no
 * items (a picture, a refused reading), so the census keeps what it measured.
 */
export function vectorFeatures(object: SourceObjectV1): VectorFeatureFactsV1 | undefined {
  const items = object.vectorItems?.items;
  if (!items || items.length === 0) return undefined;
  const fills = new Set<string>();
  const series = new Set<string>();
  let hasText = false;
  for (const item of items) {
    if (item.kind === 'text') hasText = true;
    const hex = fillHex(item);
    if (hex) fills.add(hex);
    if (item.series) series.add(item.series);
  }
  return { fillCount: fills.size, hasText, seriesCount: series.size };
}

/** One colour use a drawing states, in the census's own terms. */
export interface VectorColourUseV1 {
  /** `<object>:series:<n>` for a series colour, else `<object>:<channel>:<hex>`. */
  useId: string;
  /** `#rrggbb`, lower case. */
  hex: string;
  /** `text` is ink (a glyph run or a text part), `series` a member of the drawing's distinction set. */
  channel: 'fill' | 'stroke' | 'text' | 'series';
  /** Area in reference px squared for a fill, length times width for a stroke. */
  weight: number;
  /** The drawing's own object id, on a series use, so its members stay apart. */
  distinctionSet?: string;
}

/**
 * A drawing's colour uses, one per channel and colour, sorted so two readings
 * agree. A part that states a series name (a bar) joins the series set, one use
 * per distinct colour; a small grey filled part is a glyph run and counts as ink,
 * which is what lets an ink mapping reach an outlined label; every other fill is a
 * fill, and every stroke a stroke. Weights are measured at the object's own size,
 * so a drawing weighs what a plain shape covering the same area weighs.
 */
export function vectorColourUses(object: SourceObjectV1): VectorColourUseV1[] {
  const items = object.vectorItems;
  if (!items || items.items.length === 0) return [];
  const sx = items.viewBox.w > 0 ? object.box.w / items.viewBox.w : 1;
  const sy = items.viewBox.h > 0 ? object.box.h / items.viewBox.h : 1;
  const byKey = new Map<string, VectorColourUseV1>();
  const seriesIndex = new Map<string, number>();
  const add = (channel: VectorColourUseV1['channel'], hex: string, weight: number): void => {
    let useId: string;
    if (channel === 'series') {
      let n = seriesIndex.get(hex);
      if (n === undefined) {
        n = seriesIndex.size + 1;
        seriesIndex.set(hex, n);
      }
      useId = `${object.id}:series:${n}`;
    } else {
      useId = `${object.id}:${channel}:${hex.slice(1)}`;
    }
    const hit = byKey.get(useId);
    if (hit) {
      hit.weight += weight;
      return;
    }
    const use: VectorColourUseV1 = { useId, hex, channel, weight };
    if (channel === 'series') use.distinctionSet = object.id;
    byKey.set(useId, use);
  };

  for (const item of items.items) {
    if (item.kind === 'text') {
      const hex = fillHex(item);
      if (hex) add('text', hex, Math.max(1, item.text.length) * item.size * item.size * sx * sy * 0.5);
      continue;
    }
    const area = Math.max(0, item.box.w * sx) * Math.max(0, item.box.h * sy);
    const hex = fillHex(item);
    if (hex) {
      if (item.series) add('series', hex, area);
      else if (isGlyphRun(item, items.viewBox.h, hex)) add('text', hex, area);
      else add('fill', hex, area);
    }
    const stroke = item.stroke?.color.hex ? normal(item.stroke.color.hex) : undefined;
    if (stroke && item.stroke) {
      const length = item.shape === 'line' ? Math.hypot(item.box.w * sx, item.box.h * sy) : 2 * (item.box.w * sx + item.box.h * sy);
      add('stroke', stroke, length * Math.max(1, item.stroke.width * Math.sqrt(sx * sy)));
    }
  }
  return [...byKey.values()]
    .map((use) => ({ ...use, weight: Math.round(use.weight * 1000) / 1000 }))
    .sort((a, b) => (a.useId < b.useId ? -1 : a.useId > b.useId ? 1 : 0));
}

/** What the census adds when a drawing reads as a chart. */
export interface VectorChartEvidenceV1 {
  class: 'chart';
  confidence: number;
  evidence: EvidenceV1[];
}

/**
 * Does this drawing read as a chart? It does when its own title names a chart,
 * or when it holds at least three axis-aligned bars sharing one edge and states
 * at least two series names. Undefined otherwise, so the diagram rule and the
 * picture rules decide as they do for every drawing.
 */
export function vectorChartEvidence(object: SourceObjectV1): VectorChartEvidenceV1 | undefined {
  const items = object.vectorItems;
  if (!items || items.items.length === 0) return undefined;
  const titled = typeof items.title === 'string' && /\bchart\b/i.test(items.title);
  const bars = items.items.filter((item): item is VectorPathItemV1 => item.kind === 'path' && item.shape === 'rect');
  const sharedEdge = Math.max(0, ...['x0', 'x1', 'y0', 'y1'].map((edge) => mostShared(bars, edge as 'x0' | 'x1' | 'y0' | 'y1')));
  const series = new Set(items.items.map((item) => item.series).filter((name): name is string => Boolean(name)));
  const barred = sharedEdge >= CHART_MIN_BARS && series.size >= CHART_MIN_SERIES;
  if (!titled && !barred) return undefined;
  const fills = vectorFeatures(object)?.fillCount ?? 0;
  const evidence: EvidenceV1[] = [];
  if (titled) evidence.push({ signal: 'native-tag', value: items.title ?? '', weight: 0.4 });
  if (barred) evidence.push({ signal: 'column-alignment', value: sharedEdge, weight: 0.3 });
  evidence.push({ signal: 'fill-count', value: fills, weight: 0.2 });
  return { class: 'chart', confidence: VECTOR_CHART_CONFIDENCE, evidence };
}

/** The fill a part paints, as `#rrggbb`, or undefined for an outline. */
function fillHex(item: VectorItemV1): string | undefined {
  const fill = item.fill;
  if (!fill || 'none' in fill || !fill.hex) return undefined;
  return normal(fill.hex);
}

function normal(hex: string): string {
  return `#${hex.trim().toLowerCase().replace(/^#/, '').slice(0, 6)}`;
}

/** A small grey filled part with no series and no stroke: the outline of a run of glyphs. */
function isGlyphRun(item: VectorPathItemV1, height: number, hex: string): boolean {
  if (item.shape || item.stroke || item.series) return false;
  if (height > 0 && item.box.h > height * GLYPH_HEIGHT_SHARE) return false;
  const oklch = hexToOklch(hex);
  return (oklch ? oklch.c : 0) < INK_CHROMA_CEILING;
}

/** How many bars share their most common value of one edge, within half a unit. */
function mostShared(bars: readonly VectorPathItemV1[], edge: 'x0' | 'x1' | 'y0' | 'y1'): number {
  const counts = new Map<number, number>();
  for (const bar of bars) {
    const v = edge === 'x0' ? bar.box.x : edge === 'x1' ? bar.box.x + bar.box.w : edge === 'y0' ? bar.box.y : bar.box.y + bar.box.h;
    const key = Math.round(v * 2) / 2;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}
