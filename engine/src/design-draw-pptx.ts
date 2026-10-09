// SPDX-License-Identifier: MPL-2.0
/** The native deck's flat-primitive reading, distinct from Design's CSS geometry. */
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { DesignDrawCompileOpts, DrawBox, DrawPaint, DrawShapeOp, DrawStroke } from './design-draw.ts';
import { EMU_PER_PX, type PptxRect } from './pptx.ts';

/** Presence is significant: the original native result states even a zero or negative rounded radius. */
interface PptxPrimitiveOp extends DrawShapeOp { nativePptx: { rounded: boolean } }

const string = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }
  return fallback;
};
const emu = (value: number): number => Math.round(value * EMU_PER_PX);

/** Page selection, visibility, notes and all other row families remain with the native producer. */
export function isPptxPrimitiveRow(row: DesignBoxRowV1, origin: { x: number; y: number } = { x: 0, y: 0 }, geometry?: DrawBox): boolean {
  if (!['', 'box'].includes(string(row.kind)) || !['', 'rect', 'rounded'].includes(string(row.shape))) return false;
  for (const field of ['grad', 'clip', 'image', 'text', 'path', 'pathPaint', 'headStart', 'headEnd', 'kf', 'enter', 'exit', 'hold', 'matchOf', 'strokeDashArray']) {
    if (string(row[field]).trim()) return false;
  }
  if (!['', 'none'].includes(string(row.shadow)) || !['', 'normal'].includes(string(row.blend))) return false;
  if (!['', 'solid'].includes(string(row.strokeDash))) return false;
  if (['blur', 'bgBlur', 'rx', 'ry'].some(field => number(row[field]) !== 0)) return false;
  if (row.start != null || row.dur != null || string(row.lane) === 'seq') return false;
  // The old branch still handles values whose EMU conversion exceeds finite arithmetic.
  const coordinates = geometry ?? { x: number(row.x), y: number(row.y), w: number(row.w, 1), h: number(row.h, 1) };
  return [coordinates.x - origin.x, coordinates.y - origin.y, coordinates.w, coordinates.h, number(row.radius), number(row.strokeW)]
    .every(value => Number.isFinite(emu(value)));
}

function validColor(color: string, alpha?: number): void {
  if (!/^#[0-9a-f]{6}$/i.test(color) || (alpha !== undefined && (!Number.isFinite(alpha) || alpha < 0 || alpha > 1))) {
    throw new Error('PPTX primitives need resolved sRGB paint.');
  }
}
function validatePaint(fills: DrawPaint[], stroke?: DrawStroke): void {
  if (fills.length > 1) throw new Error('PPTX primitives carry at most one solid fill.');
  for (const fill of fills) {
    if (fill.kind !== 'color') throw new Error('PPTX primitive paint must be solid.');
    validColor(fill.color, fill.opacity);
  }
  if (!stroke) return;
  validColor(stroke.color, stroke.opacity);
  if (!Number.isFinite(stroke.width) || stroke.width <= 0 || !Number.isFinite(emu(stroke.width))
    || stroke.align || stroke.dash || stroke.cap || stroke.join) {
    throw new Error('PPTX primitives need the native solid line.');
  }
}

/** Keep the producer's Number reading and raw geometry until its one EMU quantization. Paint alpha is already folded. */
export function compilePptxCompatRow(row: DesignBoxRowV1, origin: { x: number; y: number }, supplied: DesignDrawCompileOpts['pptxCompat']): PptxPrimitiveOp {
  if (!isPptxPrimitiveRow(row, origin, supplied?.geometry)) throw new Error('This row needs the legacy native PPTX producer.');
  if (!supplied) throw new Error('The PPTX compatibility reading needs resolved paints.');
  validatePaint(supplied.fills, supplied.stroke);
  const rounded = string(row.shape) === 'rounded', rot = number(row.rot);
  const geometry = supplied.geometry ?? { x: number(row.x), y: number(row.y), w: number(row.w, 1), h: number(row.h, 1) };
  return {
    id: string(row.id), op: 'shape', compatibility: 'pptx-native-v1', nativePptx: { rounded },
    box: { x: geometry.x - origin.x, y: geometry.y - origin.y,
      w: Math.max(1 / EMU_PER_PX, geometry.w), h: Math.max(1 / EMU_PER_PX, geometry.h) },
    opacity: 100, shape: { kind: 'rect', radius: rounded ? number(row.radius) : 0 },
    ...(rot !== 0 ? { pose: { rot, flipH: false, flipV: false } } : {}),
    fills: supplied.fills.map(fill => ({ ...fill })),
    ...(supplied.stroke ? { stroke: { ...supplied.stroke } } : {}),
  };
}

/** Read only evaluated geometry and paints; no authored row, resolver, master or asset access. */
export function designDrawPptx(op: DrawShapeOp): PptxRect {
  if (op.compatibility !== 'pptx-native-v1' || !('nativePptx' in op)
    || !op.nativePptx || typeof op.nativePptx !== 'object' || !Object.hasOwn(op.nativePptx, 'rounded') || !('rounded' in op.nativePptx)
    || typeof op.nativePptx.rounded !== 'boolean') throw new Error('PPTX needs its named native-primitive compatibility reading.');
  if (op.words || op.picture || op.clip || op.blend || op.shadow || op.blur || op.outline || op.fillRule
    || op.pose?.flipH || op.pose?.flipV || op.shape.kind !== 'rect' || op.opacity !== 100) {
    throw new Error('PPTX native-primitive evaluation contains unsupported content.');
  }
  const { x, y, w, h } = op.box;
  if (![x, y, w, h, op.shape.radius, op.pose?.rot ?? 0].every(Number.isFinite) || w < 1 / EMU_PER_PX || h < 1 / EMU_PER_PX
    || ![x, y, w, h, op.shape.radius].every(value => Number.isFinite(emu(value)))) {
    throw new Error('PPTX primitive geometry is not finite or in range.');
  }
  validatePaint(op.fills, op.stroke);
  const fill = op.fills[0], stroke = op.stroke;
  if (fill && fill.kind !== 'color') throw new Error('PPTX primitive paint must be solid.');
  return {
    kind: 'rect', x: emu(x), y: emu(y), cx: Math.max(1, emu(w)), cy: Math.max(1, emu(h)),
    ...(op.pose?.rot ? { rot: op.pose.rot } : {}),
    ...(fill ? { fill: { solid: fill.color.slice(1), ...(fill.opacity !== undefined ? { alpha: fill.opacity } : {}) } } : {}),
    ...(stroke ? { line: { color: stroke.color.slice(1), w: emu(stroke.width), ...(stroke.opacity !== undefined ? { alpha: stroke.opacity } : {}) } } : {}),
    ...(op.nativePptx.rounded ? { radius: emu(op.shape.radius) } : {}),
  };
}
