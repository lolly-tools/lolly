// SPDX-License-Identifier: MPL-2.0
/**
 * Portable, renderer-neutral inspection of the Design tool's flat `boxes` value.
 *
 * This is deliberately a READ model, not a second saved-document format. Design
 * keeps its permanent URL/input contracts while agents, shells and accessibility
 * tooling get one semantic answer for "what is in this document?". Anything that
 * needs layout (text overflow, computed contrast, resolved fonts) is named in
 * `requiresMount` instead of being guessed from authored values.
 */

export const DESIGN_DOCUMENT_VERSION = 1 as const;

export const DESIGN_LAYER_KINDS = [
  'box',
  'text',
  'image',
  'path',
  'audio',
  'camera',
  'frame',
] as const;

export type DesignLayerKindV1 = (typeof DESIGN_LAYER_KINDS)[number];
export type DesignFindingSeverityV1 = 'error' | 'warn' | 'info';

export interface DesignBoundsV1 {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface DesignTimingV1 {
  start: number;
  duration: number;
  end: number;
  lane?: string;
}

export interface DesignLayerInspectionV1 {
  id: string;
  index: number;
  kind: DesignLayerKindV1 | 'unknown';
  name: string;
  bounds: DesignBoundsV1;
  artboardId?: string;
  zIndex: number;
  hidden: boolean;
  locked: boolean;
  text?: string;
  assetId?: string;
  timing?: DesignTimingV1;
}

export interface DesignArtboardInspectionV1 {
  id: string;
  name: string;
  order: number;
  bounds: DesignBoundsV1;
  childLayerIds: string[];
  clipChildren: boolean;
}

export type DesignFindingIdV1 =
  | 'design.boxes.invalid'
  | 'design.layer.invalid'
  | 'design.layer.id-missing'
  | 'design.layer.id-duplicate'
  | 'design.layer.kind-unknown'
  | 'design.layer.dimension-invalid'
  | 'design.layer.artboard-missing'
  | 'design.layer.outside-artboard'
  | 'design.layer.unassigned'
  | 'design.text.empty'
  | 'design.image.empty'
  | 'design.artboard.unnamed'
  | 'design.artboard.empty';

export interface DesignFindingV1 {
  id: DesignFindingIdV1;
  severity: DesignFindingSeverityV1;
  path: string;
  message: string;
  layerId?: string;
  artboardId?: string;
}

export interface DesignInspectionV1 {
  version: typeof DESIGN_DOCUMENT_VERSION;
  valid: boolean;
  summary: {
    artboards: number;
    layers: number;
    hiddenLayers: number;
    timedLayers: number;
    duration: number;
    errors: number;
    warnings: number;
  };
  artboards: DesignArtboardInspectionV1[];
  layers: DesignLayerInspectionV1[];
  looseLayerIds: string[];
  findings: DesignFindingV1[];
  /** Checks that authored values cannot answer honestly. */
  requiresMount: readonly ['text-overflow', 'computed-contrast', 'resolved-fonts'];
}

export interface InspectDesignV1Options {
  /** Used only when the document has no artboards. */
  width?: number;
  /** Used only when the document has no artboards. */
  height?: number;
}

type Row = Record<string, unknown>;

const KINDS = new Set<string>(DESIGN_LAYER_KINDS);
const REQUIRES_MOUNT = ['text-overflow', 'computed-contrast', 'resolved-fonts'] as const;

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function assetId(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ref = value as { id?: unknown; url?: unknown };
  if (typeof ref.id === 'string' && ref.id) return ref.id;
  if (typeof ref.url === 'string' && ref.url) return ref.url;
  return undefined;
}

function boundsOf(row: Row): DesignBoundsV1 {
  return {
    x: finite(row.x),
    y: finite(row.y),
    width: finite(row.w),
    height: finite(row.h),
    rotation: finite(row.rot),
  };
}

function contains(outer: DesignBoundsV1, inner: DesignBoundsV1): boolean {
  // Authored frames and children share one global coordinate space. Rotation needs
  // a mounted geometry walk, so this proves only the common axis-aligned case.
  if (outer.rotation || inner.rotation) return true;
  const epsilon = 0.01;
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  );
}

function finding(
  findings: DesignFindingV1[],
  id: DesignFindingIdV1,
  severity: DesignFindingSeverityV1,
  path: string,
  message: string,
  refs: Pick<DesignFindingV1, 'layerId' | 'artboardId'> = {}
): void {
  findings.push({ id, severity, path, message, ...refs });
}

/** Inspect a Design `boxes` value without mounting or rendering it. */
export function inspectDesignV1(
  boxes: unknown,
  opts: InspectDesignV1Options = {}
): DesignInspectionV1 {
  const findings: DesignFindingV1[] = [];
  if (!Array.isArray(boxes)) {
    finding(findings, 'design.boxes.invalid', 'error', '/boxes', 'Boxes must be an array.');
    return finish([], [], findings, opts);
  }

  const layers: DesignLayerInspectionV1[] = [];
  const rows = new Map<string, Row>();
  const seen = new Set<string>();

  boxes.forEach((value, index) => {
    const path = `/boxes/${index}`;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      finding(findings, 'design.layer.invalid', 'error', path, 'A layer must be an object.');
      return;
    }
    const row = value as Row;
    const id = text(row.id).trim();
    const rawKind = text(row.kind) || 'box';
    const kind: DesignLayerInspectionV1['kind'] = KINDS.has(rawKind)
      ? (rawKind as DesignLayerKindV1)
      : 'unknown';
    if (!id) {
      finding(
        findings,
        'design.layer.id-missing',
        'error',
        `${path}/id`,
        'Every layer needs a stable id.'
      );
    } else if (seen.has(id)) {
      finding(
        findings,
        'design.layer.id-duplicate',
        'error',
        `${path}/id`,
        `Layer id "${id}" is duplicated.`,
        { layerId: id }
      );
    } else {
      seen.add(id);
      rows.set(id, row);
    }
    if (kind === 'unknown') {
      finding(
        findings,
        'design.layer.kind-unknown',
        'error',
        `${path}/kind`,
        `Unknown layer kind "${rawKind}".`,
        id ? { layerId: id } : {}
      );
    }
    const bounds = boundsOf(row);
    if (bounds.width <= 0 || bounds.height <= 0) {
      finding(
        findings,
        'design.layer.dimension-invalid',
        'error',
        path,
        'Layer width and height must be greater than zero.',
        id ? { layerId: id } : {}
      );
    }
    const start = finite(row.start);
    const duration = finite(row.dur);
    const timed = row.start !== undefined || row.dur !== undefined || text(row.lane) !== '';
    const layer: DesignLayerInspectionV1 = {
      id,
      index,
      kind,
      name: text(row.name).trim(),
      bounds,
      ...(text(row.frame) ? { artboardId: text(row.frame) } : {}),
      zIndex: finite(row.z, index),
      hidden: row.hidden === true,
      locked: row.locked === true,
      ...(kind === 'text' ? { text: text(row.text) } : {}),
      ...(['image', 'audio', 'camera'].includes(kind) && assetId(row.image)
        ? { assetId: assetId(row.image) }
        : {}),
      ...(timed
        ? {
            timing: {
              start,
              duration,
              end: start + duration,
              ...(text(row.lane) ? { lane: text(row.lane) } : {}),
            },
          }
        : {}),
    };
    layers.push(layer);
    if (kind === 'text' && !text(row.text).trim()) {
      finding(
        findings,
        'design.text.empty',
        'warn',
        `${path}/text`,
        'Text layer is empty.',
        id ? { layerId: id } : {}
      );
    }
    if (kind === 'image' && !assetId(row.image)) {
      finding(
        findings,
        'design.image.empty',
        'warn',
        `${path}/image`,
        'Image layer has no asset.',
        id ? { layerId: id } : {}
      );
    }
  });

  const artboardLayers = layers.filter((layer) => layer.kind === 'frame');
  const artboardIds = new Set(artboardLayers.map((layer) => layer.id).filter(Boolean));
  const children = new Map<string, string[]>();
  for (const id of artboardIds) children.set(id, []);

  for (const layer of layers) {
    if (layer.kind === 'frame' || !layer.artboardId) continue;
    const parent = layers.find(
      (candidate) => candidate.id === layer.artboardId && candidate.kind === 'frame'
    );
    if (!parent) {
      finding(
        findings,
        'design.layer.artboard-missing',
        'error',
        `/boxes/${layer.index}/frame`,
        `Layer references missing artboard "${layer.artboardId}".`,
        { layerId: layer.id, artboardId: layer.artboardId }
      );
      continue;
    }
    children.get(parent.id)?.push(layer.id);
    if (!contains(parent.bounds, layer.bounds)) {
      finding(
        findings,
        'design.layer.outside-artboard',
        'warn',
        `/boxes/${layer.index}`,
        `Layer extends outside artboard "${parent.name || parent.id}".`,
        { layerId: layer.id, artboardId: parent.id }
      );
    }
  }

  const artboards: DesignArtboardInspectionV1[] = artboardLayers
    .map((layer) => {
      const row = rows.get(layer.id) ?? {};
      const childLayerIds = children.get(layer.id) ?? [];
      if (!layer.name) {
        finding(
          findings,
          'design.artboard.unnamed',
          'warn',
          `/boxes/${layer.index}/name`,
          'Artboard has no name.',
          { layerId: layer.id, artboardId: layer.id }
        );
      }
      if (!childLayerIds.length) {
        finding(
          findings,
          'design.artboard.empty',
          'warn',
          `/boxes/${layer.index}`,
          `Artboard "${layer.name || layer.id}" is empty.`,
          { layerId: layer.id, artboardId: layer.id }
        );
      }
      return {
        id: layer.id,
        name: layer.name,
        order: finite(row.order, layer.index),
        bounds: layer.bounds,
        childLayerIds,
        clipChildren: row.clipChildren !== false,
      };
    })
    .sort((a, b) => a.order - b.order || a.bounds.x - b.bounds.x || a.id.localeCompare(b.id));

  const looseLayerIds = layers
    .filter((layer) => layer.kind !== 'frame' && !layer.artboardId)
    .map((layer) => layer.id)
    .filter(Boolean);
  if (artboards.length) {
    for (const id of looseLayerIds) {
      const layer = layers.find((item) => item.id === id)!;
      finding(
        findings,
        'design.layer.unassigned',
        'info',
        `/boxes/${layer.index}/frame`,
        'Layer is not assigned to an artboard.',
        { layerId: id }
      );
    }
  }

  return finish(layers, artboards, findings, opts, looseLayerIds);
}

function finish(
  layers: DesignLayerInspectionV1[],
  artboards: DesignArtboardInspectionV1[],
  findings: DesignFindingV1[],
  opts: InspectDesignV1Options,
  looseLayerIds: string[] = []
): DesignInspectionV1 {
  // Keep opts in the contract even when there are no artboards: consumers can pass
  // the manifest size now without us manufacturing a pretend artboard from it.
  void opts.width;
  void opts.height;
  const errors = findings.filter((item) => item.severity === 'error').length;
  const warnings = findings.filter((item) => item.severity === 'warn').length;
  return {
    version: DESIGN_DOCUMENT_VERSION,
    valid: errors === 0,
    summary: {
      artboards: artboards.length,
      layers: layers.filter((layer) => layer.kind !== 'frame').length,
      hiddenLayers: layers.filter((layer) => layer.hidden).length,
      timedLayers: layers.filter((layer) => layer.timing).length,
      duration: layers.reduce((max, layer) => Math.max(max, layer.timing?.end ?? 0), 0),
      errors,
      warnings,
    },
    artboards,
    layers,
    looseLayerIds,
    findings,
    requiresMount: REQUIRES_MOUNT,
  };
}
