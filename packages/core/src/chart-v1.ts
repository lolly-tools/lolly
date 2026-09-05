// SPDX-License-Identifier: MPL-2.0
/**
 * The portable Chart document contract.
 *
 * A chart's meaning lives here; D3, Three.js, ECharts and Plotly are renderer
 * details.  The types deliberately contain no DOM nodes, callbacks, formatter
 * functions, shaders or vendor option objects, so the same document can travel
 * through the web shell, CLI, MCP and a future document node unchanged.
 */

export const CHART_SPEC_VERSION = 1 as const;

export type ChartValue = string | number | boolean | null;
export type ChartFieldType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';
export type ChartFieldRole =
  | 'dimension'
  | 'measure'
  | 'identifier'
  | 'time'
  | 'series'
  | 'uncertainty'
  | 'unknown';
export type ChartFieldFormat =
  | 'plain'
  | 'integer'
  | 'decimal'
  | 'percent'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean';
export type ChartDimension = 2 | 3;
export type ChartExportFidelity = 'vector' | 'hybrid' | 'raster';

export type ChartMark =
  | 'bar'
  | 'line'
  | 'area'
  | 'point'
  | 'arc'
  | 'radial-bar'
  | 'radar'
  | 'treemap'
  | 'pack'
  | 'heatmap'
  | 'histogram'
  | 'box'
  | 'violin'
  | 'beeswarm'
  | 'lollipop'
  | 'dumbbell'
  | 'slope'
  | 'bump'
  | 'stream'
  | 'waterfall'
  | 'marimekko'
  | 'parallel'
  | 'polar'
  | 'funnel'
  | 'gauge'
  | 'waffle'
  | 'sunburst'
  | 'icicle'
  | 'chord'
  | 'wordcloud'
  | 'rule'
  | 'density'
  | 'hexbin'
  | 'regression'
  | 'candlestick'
  | 'bar3d'
  | 'line3d'
  | 'ribbon3d'
  | 'scatter3d'
  | 'surface3d'
  | 'mesh3d'
  | 'volume3d';

export type ChartChannel =
  | 'x'
  | 'y'
  | 'z'
  | 'size'
  | 'colour'
  | 'label'
  | 'detail'
  | 'frame'
  | 'low'
  | 'high'
  | 'open'
  | 'close'
  | 'facetX'
  | 'facetY'
  | 'source'
  | 'target';

export interface ChartFieldV1 {
  id: string;
  label: string;
  type: ChartFieldType;
  /** Inferred or explicitly assigned semantic role; never renderer vocabulary. */
  role?: ChartFieldRole;
  /** Portable display meaning inferred from source cells. */
  format?: ChartFieldFormat;
  nullable?: boolean;
}

export interface ChartDatasetV1 {
  id: string;
  fields: ChartFieldV1[];
  rows: Record<string, ChartValue>[];
  note?: string;
  source?: { id?: string; checksum?: string; label?: string };
}

export interface ChartEncodingV1 {
  field: string;
  type?: ChartFieldType;
  title?: string;
  scale?: string;
  formatter?: string;
}

export interface ChartSeriesV1 {
  id: string;
  name: string;
  dataset: string;
  mark: ChartMark;
  channels: Partial<Record<ChartChannel, ChartEncodingV1>>;
  stack?: 'none' | 'stacked' | 'normalised';
}

export interface ChartScaleV1 {
  id: string;
  type: 'linear' | 'log' | 'sqrt' | 'time' | 'band' | 'ordinal' | 'symlog';
  domain?: ChartValue[];
  zero?: boolean;
  nice?: boolean;
  clamp?: boolean;
}

export interface ChartAxisV1 {
  id: string;
  scale: string;
  side: 'top' | 'right' | 'bottom' | 'left' | 'z';
  title?: string;
  formatter?: string;
  grid?: boolean;
  ticks?: number;
}

export interface ChartLegendV1 {
  id: string;
  series: string[];
  position: string;
  title?: string;
}

export interface ChartFormatterV1 {
  type: 'auto' | 'number' | 'percent' | 'currency' | 'date' | 'datetime' | 'duration';
  locale?: string;
  currency?: string;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'compact' | 'scientific';
}

export interface ChartThemeV1 {
  id: string;
  source: 'brand-profile' | 'brand-derived' | 'lolly-fallback';
  sourceId?: string;
  sourceLabel?: string;
  sourceChecksum?: string;
  /** The source design-system material is read-only on this host. */
  locked?: boolean;
  font: { brand?: string; display?: string; mono?: string };
  colours: {
    surface: string;
    ink: string;
    muted: string;
    edge: string;
    primary: string;
    secondary: string;
    categorical: string[];
    sequential: string[];
    diverging: string[];
  };
  marks: {
    lineWidth: number;
    cornerRadius: number;
    pointShape: 'circle' | 'square' | 'diamond';
    patterns: boolean;
  };
  scene: {
    material: 'accurate' | 'matte' | 'gloss' | 'glass';
    roughness: number;
    metalness: number;
    shadows: boolean;
  };
  motion: { easing: 'linear' | 'smooth'; durationMs: number; staggerMs: number };
  provenance?: Record<string, string>;
}

export interface ChartMotionV1 {
  enabled: boolean;
  preset: 'none' | 'reveal' | 'stagger' | 'by-frame-field' | 'race' | 'orbit' | 'reveal-orbit' | 'data-flight';
  duration: number;
  loop: 'once' | 'loop' | 'bounce';
  easing: 'linear' | 'smooth' | 'steps';
  poster: number;
  frameField?: string;
}

export interface ChartAccessibilityV1 {
  title: string;
  description: string;
  readingOrder: string[];
  table: {
    columns: string[];
    rows: ChartValue[][];
  };
  colourOnly: boolean;
  patterns: boolean;
  motionDescription?: string;
}

export interface ChartPresentationV1 {
  style: string;
  dimension: ChartDimension;
  rendererFamily: 'svg' | 'scene-3d' | 'scientific' | 'high-volume';
  exportFidelity: ChartExportFidelity;
  width: number;
  height: number;
  transparent: boolean;
  camera?: {
    projection: 'orthographic' | 'perspective';
    azimuth: number;
    elevation: number;
  };
}

export interface ChartSpecV1 {
  version: typeof CHART_SPEC_VERSION;
  datasets: ChartDatasetV1[];
  series: ChartSeriesV1[];
  scales?: ChartScaleV1[];
  axes?: ChartAxisV1[];
  legends?: ChartLegendV1[];
  formatting?: Record<string, ChartFormatterV1>;
  theme: ChartThemeV1;
  motion?: ChartMotionV1;
  presentation: ChartPresentationV1;
  accessibility: ChartAccessibilityV1;
}

export type ChartFindingSeverity = 'info' | 'warning' | 'error';

export interface ChartFindingV1 {
  id: string;
  severity: ChartFindingSeverity;
  message: string;
  path?: string;
}

export interface ChartColumnProfileV1 {
  name: string;
  type: ChartFieldType;
  role: ChartFieldRole;
  format: ChartFieldFormat;
  missing: number;
  unique: number;
}

export interface ChartDataProfileV1 {
  shape: 'empty' | 'single' | 'wide' | 'long' | 'matrix';
  rows: number;
  columns: number;
  missing: number;
  fields: ChartColumnProfileV1[];
}

export interface ChartRecommendationV1 {
  intent: 'auto' | 'compare' | 'trend' | 'composition' | 'distribution' | 'relationship' | 'uncertainty' | 'story';
  renderMode: 'vector' | 'statistical' | 'scene' | 'cinematic';
  chartType: string;
  label: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  mappings: Partial<Record<'x' | 'y' | 'z' | 'colour' | 'size' | 'facet' | 'label' | 'error' | 'frame' | 'camera', string[]>>;
}

export interface ChartValidationResultV1 {
  ok: boolean;
  findings: ChartFindingV1[];
}

export interface ResolvedChartReportV1 {
  version: typeof CHART_SPEC_VERSION;
  rendererFamily: ChartPresentationV1['rendererFamily'];
  rendererId?: string;
  style: string;
  dimension: ChartDimension;
  exportFidelity: ChartExportFidelity;
  datasets: number;
  rows: number;
  series: number;
  theme: Pick<
    ChartThemeV1,
    'id' | 'source' | 'sourceId' | 'sourceLabel' | 'sourceChecksum' | 'locked'
  >;
  dataProfile?: ChartDataProfileV1;
  recommendation?: ChartRecommendationV1;
  findings: ChartFindingV1[];
}
