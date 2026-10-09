// SPDX-License-Identifier: MPL-2.0
/** Internal P3f admission. This detached evaluation is never stored in an authored document. */
import { DESIGN_DRAW_VERSION, type DesignDrawPage, type DrawOp } from './design-draw.ts';

export const DESIGN_RASTER_VERSION = 0;
export const DESIGN_RASTER_RECIPE = 'design-static-primitives-rgba8-v0';
export const DESIGN_RASTER_MAX_PIXELS = 16 * 1024 * 1024;
export const DESIGN_RASTER_MAX_OPS = 1024;
export const DESIGN_RASTER_MAX_DIMENSION = 8192;

export interface DesignRasterFinding { id: string; feature: string }
export interface DesignRasterPrimitive {
  readonly id: string;
  readonly box: readonly [number, number, number, number];
  readonly shape: 'rect' | 'ellipse';
  readonly radius: number;
  /** Straight sRGB, with the single paint's alpha multiplied by group opacity. */
  readonly color: readonly [number, number, number, number];
  readonly pose: readonly [number, boolean, boolean];
}
export interface DesignRasterEvaluation {
  readonly version: typeof DESIGN_RASTER_VERSION;
  readonly drawingVersion: typeof DESIGN_DRAW_VERSION;
  readonly recipe: typeof DESIGN_RASTER_RECIPE;
  readonly width: number;
  readonly height: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpi: number;
  /** Empty in this slice: pictures and fonts refuse admission rather than inventing resource identities. */
  readonly resources: readonly [];
  readonly ops: readonly DesignRasterPrimitive[];
}
export type DesignRasterAdmission = { ok: true; evaluation: DesignRasterEvaluation } | { ok: false; findings: DesignRasterFinding[] };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const size = (n: unknown): n is number => finite(n) && Number.isInteger(n) && n >= 1 && n <= DESIGN_RASTER_MAX_DIMENSION;
const keys = (v: object, admitted: readonly string[]) => Object.keys(v).every(k => admitted.includes(k));
const exact = (v: object, admitted: readonly string[]) => Object.keys(v).length === admitted.length && keys(v, admitted);
const unit = (n: unknown): n is number => finite(n) && n >= 0 && n <= 1;
const dense = (value: readonly unknown[]) => { for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) return false; return true; };

function primitive(op: DrawOp, findings: DesignRasterFinding[]): DesignRasterPrimitive | null {
  const reject = (feature: string): null => { findings.push({ id: typeof op?.id === 'string' ? op.id.slice(0, 256) : '', feature }); return null; };
  if (op?.op !== 'shape') return reject('raster-op');
  if (!keys(op, ['id', 'op', 'box', 'shape', 'fills', 'opacity', 'pose'])) return reject('raster-feature');
  const b = op.box, s = op.shape;
  if (typeof op.id !== 'string' || op.id.length > 256 || !b || !keys(b, ['x', 'y', 'w', 'h'])
    || ![b.x, b.y, b.w, b.h].every(finite) || b.w <= 0 || b.h <= 0
    || Math.max(Math.abs(b.x), Math.abs(b.y), b.w, b.h) > 1e6) return reject('raster-geometry');
  if (!s || (s.kind !== 'rect' && s.kind !== 'ellipse')) return reject('raster-path');
  if (!keys(s, s.kind === 'rect' ? ['kind', 'radius'] : ['kind'])) return reject('raster-shape');
  const radius = s.kind === 'rect' ? s.radius : 0;
  if (!finite(radius) || radius < 0 || radius > Math.min(b.w, b.h) / 2) return reject('raster-radius');
  if (!finite(op.opacity) || op.opacity < 0 || op.opacity > 100 || !Array.isArray(op.fills) || op.fills.length > 1) return reject('raster-paint');
  const paint = op.fills[0];
  if (op.fills.length && (!paint || typeof paint !== 'object' || paint.kind !== 'color' || !keys(paint, ['kind', 'color', 'opacity']) || !/^#[\da-f]{6}$/i.test(paint.color)
    || paint.opacity !== undefined && !unit(paint.opacity))) return reject('raster-paint');
  const pose = op.pose;
  if (pose !== undefined && (!pose || typeof pose !== 'object' || !keys(pose, ['rot', 'flipH', 'flipV']) || !finite(pose.rot) || Math.abs(pose.rot) > 1e6
    || typeof pose.flipH !== 'boolean' || typeof pose.flipV !== 'boolean')) return reject('raster-pose');
  const rgb = paint?.kind === 'color' ? [1, 3, 5].map(i => Number.parseInt(paint.color.slice(i, i + 2), 16) / 255) : [0, 0, 0];
  return Object.freeze({ id: op.id, box: Object.freeze([b.x, b.y, b.w, b.h]) as DesignRasterPrimitive['box'],
    shape: s.kind, radius, color: Object.freeze([...rgb, paint ? ((paint as { opacity?: number }).opacity ?? 1) * op.opacity / 100 : 0]) as DesignRasterPrimitive['color'],
    pose: Object.freeze([pose?.rot ?? 0, pose?.flipH ?? false, pose?.flipV ?? false]) as DesignRasterPrimitive['pose'] });
}

/** Whole-page admission is synchronous, before any device acquisition or asynchronous work. */
export function prepareDesignRaster(page: DesignDrawPage, output?: { width: number; height: number; dpi?: number }): DesignRasterAdmission {
  const findings: DesignRasterFinding[] = [];
  if (!page || page.version !== DESIGN_DRAW_VERSION) return { ok: false, findings: [{ id: '', feature: 'raster-version' }] };
  if (!keys(page, ['version', 'width', 'height', 'background', 'frame', 'clip', 'ops', 'findings'])) findings.push({ id: '', feature: 'raster-page' });
  const pixelWidth = output?.width ?? page.width, pixelHeight = output?.height ?? page.height, dpi = output?.dpi ?? 96;
  if (!size(page.width) || !size(page.height) || !size(pixelWidth) || !size(pixelHeight)
    || pixelWidth * pixelHeight > DESIGN_RASTER_MAX_PIXELS || !finite(dpi) || dpi < 1 || dpi > 9600) findings.push({ id: '', feature: 'raster-size' });
  if (!Array.isArray(page.ops) || page.ops.length > DESIGN_RASTER_MAX_OPS || !dense(page.ops) || !Array.isArray(page.findings) || page.findings.length > DESIGN_RASTER_MAX_OPS || !dense(page.findings)) return { ok: false, findings: [...findings, { id: '', feature: 'raster-budget' }] };
  findings.push(...page.findings.map(f => ({ id: typeof f?.id === 'string' ? f.id.slice(0, 256) : '', feature: typeof f?.feature === 'string' ? f.feature.slice(0, 128) : 'raster-finding' })));
  if (page.clip !== undefined) findings.push({ id: page.frame?.id ?? '', feature: 'raster-page-clip' });
  const frame = page.frame;
  if (frame?.shape?.kind !== 'rect' || frame.shape.radius !== 0 || !frame.box || frame.box.x !== 0 || frame.box.y !== 0
    || frame.box.w !== page.width || frame.box.h !== page.height || frame.opacity !== 100 || frame.pose) findings.push({ id: frame?.id ?? '', feature: 'raster-frame' });
  const ops = [...(frame ? [frame] : []), ...page.ops].flatMap(op => { const p = primitive(op, findings); return p ? [p] : []; });
  if (findings.length) return { ok: false, findings };
  return { ok: true, evaluation: Object.freeze({ version: DESIGN_RASTER_VERSION, drawingVersion: DESIGN_DRAW_VERSION, recipe: DESIGN_RASTER_RECIPE,
    width: page.width, height: page.height, pixelWidth, pixelHeight, dpi, resources: Object.freeze([]) as readonly [], ops: Object.freeze(ops) }) };
}

/** Validate a worker handoff without trusting a structured clone's former freeze or TypeScript type. */
export function readDesignRasterEvaluation(value: unknown): DesignRasterEvaluation | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as DesignRasterEvaluation;
  if (!exact(e, ['version', 'drawingVersion', 'recipe', 'width', 'height', 'pixelWidth', 'pixelHeight', 'dpi', 'resources', 'ops'])
    || e.version !== DESIGN_RASTER_VERSION || e.drawingVersion !== DESIGN_DRAW_VERSION || e.recipe !== DESIGN_RASTER_RECIPE
    || !size(e.pixelWidth) || !size(e.pixelHeight) || !finite(e.dpi) || e.dpi < 1 || e.dpi > 9600
    || !Array.isArray(e.resources) || e.resources.length || !Array.isArray(e.ops) || !e.ops.length || e.ops.length > DESIGN_RASTER_MAX_OPS + 1) return null;
  const rows: DrawOp[] = [];
  for (const p of e.ops) {
    if (!p || !exact(p, ['id', 'box', 'shape', 'radius', 'color', 'pose']) || !Array.isArray(p.box) || p.box.length !== 4
      || !Array.isArray(p.color) || p.color.length !== 4 || ![0, 1, 2, 3].every(i => unit(p.color[i])) || !Array.isArray(p.pose) || p.pose.length !== 3
      || !finite(p.pose[0]) || typeof p.pose[1] !== 'boolean' || typeof p.pose[2] !== 'boolean'
      || p.shape !== 'rect' && p.shape !== 'ellipse' || p.shape === 'ellipse' && p.radius !== 0) return null;
    const color = '#' + p.color.slice(0, 3).map((n: number) => { const v = n * 255, rounded = Math.round(v); return Math.abs(v - rounded) < 1e-10 ? rounded.toString(16).padStart(2, '0') : '!'; }).join('');
    rows.push({ id: p.id, op: 'shape', box: { x: p.box[0], y: p.box[1], w: p.box[2], h: p.box[3] },
      shape: p.shape === 'rect' ? { kind: 'rect', radius: p.radius } : { kind: 'ellipse' },
      fills: [{ kind: 'color', color, opacity: p.color[3] }], opacity: 100,
      ...(p.pose[0] || p.pose[1] || p.pose[2] ? { pose: { rot: p.pose[0], flipH: p.pose[1], flipV: p.pose[2] } } : {}) });
  }
  const result = prepareDesignRaster({ version: DESIGN_DRAW_VERSION, width: e.width, height: e.height, background: '', frame: rows[0] as DesignDrawPage['frame'], ops: rows.slice(1), findings: [] }, { width: e.pixelWidth, height: e.pixelHeight, dpi: e.dpi });
  return result.ok ? result.evaluation : null;
}

/** The identity names semantic input and output geometry, never an adapter or GPU resource. */
export const designRasterIdentity = (evaluation: DesignRasterEvaluation): string => JSON.stringify(evaluation);
