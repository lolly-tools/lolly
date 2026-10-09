// SPDX-License-Identifier: MPL-2.0
/** Penpot's existing flat-primitive reading, separate from Design's CSS geometry. */
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { DesignDrawCompileOpts, DrawPaint, DrawShapeOp, DrawStroke } from './design-draw.ts';
import type { PenpotIrCircle, PenpotIrRect } from './penpot-file.ts';
import { clamp } from './clamp.ts';

const string = (value: unknown): string => value == null ? '' : String(value);
const number = (value: unknown, fallback = 0): number => {
  const result = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(result) ? result : fallback;
};

/** Other row families and effects retain the original producer. Hidden is not an admission rule. */
export function isPenpotPrimitiveRow(row: Record<string, unknown>, shapeKind?: string): boolean {
  if (!['', 'box'].includes(string(row.kind))) return false;
  if (!['', 'rect', 'rounded', 'pill', 'circle', 'ellipse'].includes(shapeKind ?? string(row.shape))) return false;
  for (const field of ['grad', 'clip', 'image', 'text', 'path', 'pathPaint', 'headStart', 'headEnd', 'kf', 'enter', 'exit', 'hold']) {
    if (string(row[field]).trim()) return false;
  }
  if (!['', 'none'].includes(string(row.shadow))) return false;
  if (!['', 'normal'].includes(string(row.blend))) return false;
  if (!['', 'solid'].includes(string(row.strokeDash))) return false;
  if (['blur', 'bgBlur', 'rx', 'ry'].some(field => number(row[field]) !== 0)) return false;
  if (row.start != null || row.dur != null || string(row.lane) === 'seq') return false;
  return true;
}

function validColor(color: string, opacity = 1): void {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error('Penpot primitives need resolved sRGB paint.');
  }
}

function validatePaint(fills: DrawPaint[], stroke?: DrawStroke): void {
  if (fills.length > 1) throw new Error('Penpot primitives carry at most one solid fill.');
  for (const fill of fills) {
    if (fill.kind !== 'color') throw new Error('Penpot primitive paint must be solid.');
    validColor(fill.color, fill.opacity);
  }
  if (!stroke) return;
  validColor(stroke.color, stroke.opacity);
  if (!Number.isFinite(stroke.width) || stroke.width <= 0 || stroke.align || stroke.dash || stroke.join
    || (stroke.cap !== undefined && stroke.cap !== 'round' && stroke.cap !== 'square')) {
    throw new Error('Penpot primitives need a solid centered stroke.');
  }
}

/** Keep fractional positions, unrounded radii and rotation, and the producer's numeric coercion. */
export function compilePenpotCompatRow(
  row: DesignBoxRowV1,
  offset: { x: number; y: number },
  supplied: DesignDrawCompileOpts['penpotCompat'],
): DrawShapeOp {
  const capture = supplied?.capture;
  if (!isPenpotPrimitiveRow(row, capture?.shapeKind)) throw new Error('This row needs the legacy Penpot producer.');
  if (!supplied) throw new Error('The Penpot compatibility reading needs resolved paints.');
  validatePaint(supplied.fills, supplied.stroke);
  if (capture && (![capture.geometry.x, capture.geometry.y, capture.geometry.w, capture.geometry.h,
    capture.opacity, capture.rotation].every(Number.isFinite) || capture.geometry.w < 1 || capture.geometry.h < 1
    || capture.opacity < 0 || capture.opacity > 100 || typeof capture.shapeKind !== 'string')) {
    throw new Error('Penpot captured primitive geometry is not finite or in range.');
  }
  const box = capture
    ? { x: capture.geometry.x - offset.x, y: capture.geometry.y - offset.y, w: capture.geometry.w, h: capture.geometry.h }
    : { x: number(row.x) - offset.x, y: number(row.y) - offset.y,
      w: Math.max(1, number(row.w, 1)), h: Math.max(1, number(row.h, 1)) };
  const name = capture?.shapeKind ?? string(row.shape), rot = capture?.rotation ?? number(row.rot);
  return {
    id: string(row.id), op: 'shape', compatibility: 'penpot-native-v1', box,
    opacity: capture?.opacity ?? clamp(number(row.opacity, 100), 0, 100),
    ...(rot ? { pose: { rot, flipH: false, flipV: false } } : {}),
    shape: name === 'circle' || name === 'ellipse' ? { kind: 'ellipse' }
      : { kind: 'rect', radius: name === 'rounded' ? number(row.radius) : name === 'pill' ? Math.min(box.w, box.h) / 2 : 0 },
    fills: supplied.fills.map(fill => ({ ...fill })),
    ...(supplied.stroke ? { stroke: { ...supplied.stroke } } : {}),
  };
}

/** Emit only evaluated geometry and paint; names and token bindings remain producer metadata. */
export function designDrawPenpot(op: DrawShapeOp): PenpotIrRect | PenpotIrCircle {
  if (op.compatibility !== 'penpot-native-v1') throw new Error('Penpot needs the named native-primitive compatibility reading.');
  if (op.words || op.picture || op.clip || op.blend || op.shadow || op.blur || op.outline || op.fillRule
    || op.pose?.flipH || op.pose?.flipV || op.shape.kind === 'path') {
    throw new Error('Penpot native-primitive evaluation contains unsupported content.');
  }
  const { x, y, w, h } = op.box;
  if (![x, y, w, h, op.opacity, op.pose?.rot ?? 0].every(Number.isFinite) || w < 1 || h < 1 || op.opacity < 0 || op.opacity > 100
    || (op.shape.kind === 'rect' && !Number.isFinite(op.shape.radius))) {
    throw new Error('Penpot primitive geometry is not finite or in range.');
  }
  validatePaint(op.fills, op.stroke);
  const base = {
    x, y, w, h,
    ...(op.opacity < 100 ? { opacity: op.opacity / 100 } : {}),
    ...(op.pose?.rot ? { rotation: op.pose.rot } : {}),
    fills: op.fills.map(fill => {
      if (fill.kind !== 'color') throw new Error('Penpot primitive paint must be solid.');
      return { color: fill.color, opacity: fill.opacity ?? 1 };
    }),
    strokes: op.stroke ? [{ color: op.stroke.color, opacity: op.stroke.opacity ?? 1, width: op.stroke.width, alignment: 'center' as const,
      ...(op.stroke.cap ? { capStart: op.stroke.cap, capEnd: op.stroke.cap } : {}) }] : [],
  };
  return op.shape.kind === 'ellipse' ? { ...base, type: 'circle' } : { ...base, type: 'rect', radius: op.shape.radius };
}
