// SPDX-License-Identifier: MPL-2.0
/**
 * Pure ChartSpecV1 helpers.
 *
 * This module owns the renderer-neutral checks and the sparse-brand → complete
 * chart-theme derivation. It has no DOM, storage, networking or chart-library
 * dependency. Tool hooks emit the same wire shape; document/API consumers can
 * use these helpers directly.
 */

import type {
  ChartFindingV1,
  ChartSpecV1,
  ChartThemeV1,
  ChartValidationResultV1,
  ResolvedChartReportV1,
} from '@lolly-tools/core';
import { rotateHue } from './brand-schemes.ts';
import { deltaEOk, rampOklab } from './color-tools.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-zA-Z][a-zA-Z0-9._-]{0,127}$/;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function hex(value: unknown, fallback: string): string {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (HEX.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return fallback;
}

function colours(values: readonly unknown[] | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const c = hex(value, '');
    if (!c || out.some((existing) => existing === c || deltaEOk(existing, c) < 0.035)) continue;
    out.push(c);
  }
  return out;
}

export interface ChartBrandThemeInput {
  id?: string;
  label?: string;
  checksum?: string;
  locked?: boolean;
  font?: { brand?: string; display?: string; mono?: string };
  colours?: {
    surface?: string;
    ink?: string;
    muted?: string;
    edge?: string;
    primary?: string;
    secondary?: string;
    categorical?: string[];
    sequential?: string[];
    diverging?: string[];
  };
  monochrome?: boolean;
}

export interface ChartThemeOverrides {
  font?: Partial<ChartThemeV1['font']>;
  colours?: Partial<Omit<ChartThemeV1['colours'], 'categorical' | 'sequential' | 'diverging'>> & {
    categorical?: string[];
    sequential?: string[];
    diverging?: string[];
  };
  marks?: Partial<ChartThemeV1['marks']>;
  scene?: Partial<ChartThemeV1['scene']>;
  motion?: Partial<ChartThemeV1['motion']>;
}

/**
 * Resolve a complete semantic theme from whatever the active design system has.
 * Authored colours keep their order. Missing ramps/hues are extrapolated in
 * OKLab/OKLCH; renderer defaults never enter the result.
 */
export function resolveChartTheme(
  brand: ChartBrandThemeInput = {},
  style = 'brand-default',
  overrides: ChartThemeOverrides = {}
): ChartThemeV1 {
  const bc = brand.colours ?? {};
  const surface = hex(bc.surface, '#ffffff');
  const ink = hex(bc.ink, '#111111');
  const primary = hex(bc.primary, ink);
  const secondary = hex(bc.secondary, primary);
  const neutral = rampOklab([surface, ink], 9, { correctLightness: true });
  const muted = hex(bc.muted, neutral[5] ?? ink);
  const edge = hex(bc.edge, neutral[2] ?? muted);

  const categorical = colours([primary, secondary, ...(bc.categorical ?? [])]);
  // Golden-angle rotation fills sparse/monochrome brands without replacing the
  // authored lead colours. Perceptual de-duplication above prevents near-clones.
  for (let i = 1; categorical.length < 10 && i < 30; i++) {
    const candidate = rotateHue(primary, i * 137.50776405);
    if (!categorical.some((c) => c === candidate || deltaEOk(c, candidate) < 0.055))
      categorical.push(candidate);
  }
  // A truly neutral seed cannot gain chroma by hue rotation. Keep it honest and
  // let patterns carry category identity instead of inventing a colourful brand.
  const neutralSeed = categorical.length === 1;
  if (neutralSeed) {
    for (const c of neutral.slice(1, 8)) if (!categorical.includes(c)) categorical.push(c);
  }

  const seqAuthored = colours(bc.sequential);
  const divAuthored = colours(bc.diverging);
  const sequential =
    seqAuthored.length >= 3
      ? seqAuthored
      : rampOklab([surface, primary, ink], 7, { correctLightness: true });
  const diverging =
    divAuthored.length >= 3
      ? divAuthored
      : rampOklab([secondary, surface, primary], 7, { correctLightness: false });

  const styleMarks: Partial<ChartThemeV1['marks']> =
    style === 'editorial'
      ? { lineWidth: 2, cornerRadius: 0, pointShape: 'circle' }
      : style === 'technical'
        ? { lineWidth: 1.5, cornerRadius: 0, pointShape: 'square' }
        : style === 'poster'
          ? { lineWidth: 5, cornerRadius: 10, pointShape: 'circle' }
          : {};
  const styleScene: Partial<ChartThemeV1['scene']> =
    style === 'glass-3d'
      ? { material: 'glass', roughness: 0.12, metalness: 0.05, shadows: true }
      : style === 'technical'
        ? { material: 'accurate', roughness: 0.82, metalness: 0, shadows: false }
        : { material: 'matte', roughness: 0.58, metalness: 0.04, shadows: true };

  const sparse = !brand.colours || !bc.primary || !(bc.categorical?.length || bc.secondary);
  return {
    id: `${brand.id || 'lolly'}:${style}`,
    source: brand.id ? (sparse ? 'brand-derived' : 'brand-profile') : 'lolly-fallback',
    ...(brand.id ? { sourceId: brand.id } : {}),
    ...(brand.label ? { sourceLabel: brand.label } : {}),
    ...(brand.checksum ? { sourceChecksum: brand.checksum } : {}),
    ...(brand.id ? { locked: brand.locked === true } : {}),
    font: {
      ...(brand.font?.brand ? { brand: brand.font.brand } : {}),
      ...(brand.font?.display ? { display: brand.font.display } : {}),
      ...(brand.font?.mono ? { mono: brand.font.mono } : {}),
      ...overrides.font,
    },
    colours: {
      surface: hex(overrides.colours?.surface, surface),
      ink: hex(overrides.colours?.ink, ink),
      muted: hex(overrides.colours?.muted, muted),
      edge: hex(overrides.colours?.edge, edge),
      primary: hex(overrides.colours?.primary, primary),
      secondary: hex(overrides.colours?.secondary, secondary),
      categorical: colours(overrides.colours?.categorical).length
        ? colours(overrides.colours?.categorical)
        : categorical,
      sequential: colours(overrides.colours?.sequential).length
        ? colours(overrides.colours?.sequential)
        : sequential,
      diverging: colours(overrides.colours?.diverging).length
        ? colours(overrides.colours?.diverging)
        : diverging,
    },
    marks: {
      lineWidth: clamp(overrides.marks?.lineWidth ?? styleMarks.lineWidth ?? 3, 0.5, 16),
      cornerRadius: clamp(overrides.marks?.cornerRadius ?? styleMarks.cornerRadius ?? 3, 0, 40),
      pointShape: overrides.marks?.pointShape ?? styleMarks.pointShape ?? 'circle',
      patterns: overrides.marks?.patterns ?? (brand.monochrome === true || neutralSeed),
    },
    scene: {
      material: overrides.scene?.material ?? styleScene.material ?? 'matte',
      roughness: clamp(overrides.scene?.roughness ?? styleScene.roughness ?? 0.58, 0, 1),
      metalness: clamp(overrides.scene?.metalness ?? styleScene.metalness ?? 0.04, 0, 1),
      shadows: overrides.scene?.shadows ?? styleScene.shadows ?? true,
    },
    motion: {
      easing: overrides.motion?.easing ?? 'smooth',
      durationMs: clamp(overrides.motion?.durationMs ?? 1200, 100, 60000),
      staggerMs: clamp(overrides.motion?.staggerMs ?? 45, 0, 5000),
    },
    provenance: {
      palette: bc.categorical?.length ? 'brand:categorical' : 'derived:ordered-brand-colours',
      sequential: seqAuthored.length >= 3 ? 'brand:sequential' : 'derived:oklab',
      diverging: divAuthored.length >= 3 ? 'brand:diverging' : 'derived:oklab',
      font: brand.font?.brand ? 'brand:font.brand' : 'css:--font-brand',
    },
  };
}

function finding(
  findings: ChartFindingV1[],
  id: string,
  severity: ChartFindingV1['severity'],
  message: string,
  path?: string
): void {
  findings.push({ id, severity, message, ...(path ? { path } : {}) });
}

/** Semantic validation beyond JSON shape. It never repairs silently. */
export function validateChartSpec(spec: unknown): ChartValidationResultV1 {
  const findings: ChartFindingV1[] = [];
  if (!spec || typeof spec !== 'object') {
    finding(findings, 'chart.spec.type', 'error', 'Chart spec must be an object.');
    return { ok: false, findings };
  }
  const s = spec as Partial<ChartSpecV1>;
  if (s.version !== 1)
    finding(findings, 'chart.spec.version', 'error', 'Unsupported chart spec version.', 'version');
  if (!Array.isArray(s.datasets) || !s.datasets.length)
    finding(
      findings,
      'chart.dataset.missing',
      'error',
      'At least one dataset is required.',
      'datasets'
    );
  if (!Array.isArray(s.series) || !s.series.length)
    finding(
      findings,
      'chart.series.missing',
      'error',
      'At least one series is required.',
      'series'
    );

  const datasetIds = new Set<string>();
  const fieldsByDataset = new Map<string, Set<string>>();
  for (const [di, dataset] of (s.datasets ?? []).entries()) {
    if (!ID.test(dataset.id || ''))
      finding(findings, 'chart.dataset.id', 'error', 'Dataset id is invalid.', `datasets.${di}.id`);
    if (datasetIds.has(dataset.id))
      finding(
        findings,
        'chart.dataset.duplicate',
        'error',
        `Duplicate dataset id “${dataset.id}”.`,
        `datasets.${di}.id`
      );
    datasetIds.add(dataset.id);
    const fieldIds = new Set<string>();
    for (const [fi, field] of (dataset.fields ?? []).entries()) {
      if (!ID.test(field.id || ''))
        finding(
          findings,
          'chart.field.id',
          'error',
          'Field id is invalid.',
          `datasets.${di}.fields.${fi}.id`
        );
      if (fieldIds.has(field.id))
        finding(
          findings,
          'chart.field.duplicate',
          'error',
          `Duplicate field id “${field.id}”.`,
          `datasets.${di}.fields.${fi}.id`
        );
      fieldIds.add(field.id);
    }
    fieldsByDataset.set(dataset.id, fieldIds);
    if ((dataset.rows?.length ?? 0) > 100000)
      finding(
        findings,
        'chart.rows.limit',
        'error',
        'Dataset exceeds the 100,000-row document limit.',
        `datasets.${di}.rows`
      );
  }

  const seriesIds = new Set<string>();
  for (const [si, series] of (s.series ?? []).entries()) {
    if (!ID.test(series.id || ''))
      finding(findings, 'chart.series.id', 'error', 'Series id is invalid.', `series.${si}.id`);
    if (seriesIds.has(series.id))
      finding(
        findings,
        'chart.series.duplicate',
        'error',
        `Duplicate series id “${series.id}”.`,
        `series.${si}.id`
      );
    seriesIds.add(series.id);
    if (!datasetIds.has(series.dataset)) {
      finding(
        findings,
        'chart.series.dataset',
        'error',
        `Series “${series.id}” references missing dataset “${series.dataset}”.`,
        `series.${si}.dataset`
      );
      continue;
    }
    const fields = fieldsByDataset.get(series.dataset) ?? new Set();
    for (const [channel, encoding] of Object.entries(series.channels ?? {})) {
      if (encoding && !fields.has(encoding.field))
        finding(
          findings,
          'chart.channel.field',
          'error',
          `Channel “${channel}” references missing field “${encoding.field}”.`,
          `series.${si}.channels.${channel}`
        );
    }
    if (
      (series.mark === 'bar3d' ||
        series.mark === 'line3d' ||
        series.mark === 'ribbon3d' ||
        series.mark === 'scatter3d' ||
        series.mark === 'surface3d' ||
        series.mark === 'mesh3d' ||
        series.mark === 'volume3d') &&
      !series.channels.z
    ) {
      finding(
        findings,
        'chart.channel.z',
        'error',
        `${series.mark} requires a genuine z channel.`,
        `series.${si}.channels.z`
      );
    }
  }

  if (!s.accessibility?.title?.trim())
    finding(
      findings,
      'chart.a11y.title',
      'error',
      'An accessible chart title is required.',
      'accessibility.title'
    );
  if (!s.accessibility?.description?.trim())
    finding(
      findings,
      'chart.a11y.description',
      'error',
      'An accessible chart description is required.',
      'accessibility.description'
    );
  if (s.accessibility?.colourOnly && (s.series?.length ?? 0) > 1)
    finding(
      findings,
      'chart.a11y.colour-only',
      'warning',
      'Series are distinguished by colour alone; enable patterns or shapes.',
      'accessibility.colourOnly'
    );
  if (s.presentation?.dimension === 3 && s.presentation.exportFidelity === 'vector') {
    finding(
      findings,
      'chart.export.3d-vector',
      'info',
      'The 3-D chart declares vector output; only projected/unshaded geometry can satisfy it.',
      'presentation.exportFidelity'
    );
  }
  return { ok: !findings.some((f) => f.severity === 'error'), findings };
}

export function inspectChartSpec(spec: ChartSpecV1, rendererId?: string): ResolvedChartReportV1 {
  const validation = validateChartSpec(spec);
  return {
    version: 1,
    rendererFamily: spec.presentation.rendererFamily,
    ...(rendererId ? { rendererId } : {}),
    style: spec.presentation.style,
    dimension: spec.presentation.dimension,
    exportFidelity: spec.presentation.exportFidelity,
    datasets: spec.datasets.length,
    rows: spec.datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0),
    series: spec.series.length,
    theme: {
      id: spec.theme.id,
      source: spec.theme.source,
      ...(spec.theme.sourceId ? { sourceId: spec.theme.sourceId } : {}),
      ...(spec.theme.sourceLabel ? { sourceLabel: spec.theme.sourceLabel } : {}),
      ...(spec.theme.sourceChecksum ? { sourceChecksum: spec.theme.sourceChecksum } : {}),
      ...(spec.theme.locked != null ? { locked: spec.theme.locked } : {}),
    },
    findings: validation.findings,
  };
}
