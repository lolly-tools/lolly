// SPDX-License-Identifier: MPL-2.0
/** The native deck's primitive and linear-gradient reading, distinct from Design's CSS geometry. */
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { DesignDrawCompileOpts, DrawBox, DrawPaint, DrawShapeOp, DrawStroke } from './design-draw.ts';
import { EMU_PER_PX, type PptxRect } from './pptx.ts';

type NativeLinear = NonNullable<NonNullable<DesignDrawCompileOpts['pptxCompat']>['linear']>;
type NativeCapture = NonNullable<NonNullable<DesignDrawCompileOpts['pptxCompat']>['capture']>;
/** Presence is significant: the original native result states even a zero or negative rounded radius. */
interface PptxPrimitiveOp extends DrawShapeOp {
  nativePptx: { rounded: boolean; linear?: NativeLinear; underlayRotation?: number };
}

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
const GUARDED_CONTENT = ['grad', 'clip', 'image', 'text', 'path', 'pathPaint', 'headStart', 'headEnd', 'kf', 'enter', 'exit', 'hold', 'matchOf', 'strokeDashArray'] as const;

function capturePptxMetadata(row: DesignBoxRowV1, gradientCaptured: boolean): DesignBoxRowV1 | null {
  const prototype = Object.getPrototypeOf(row);
  if (prototype !== null && prototype !== Object.prototype) return null;
  const snapshot: DesignBoxRowV1 = Object.create(null);
  for (const field of ['id', ...(gradientCaptured ? [] : ['kind', 'shape', 'radius', 'strokeW', 'rot']),
    ...GUARDED_CONTENT.filter(field => !gradientCaptured || field !== 'grad'), 'shadow', 'blend', 'strokeDash', 'blur', 'bgBlur', 'rx', 'ry', 'start', 'dur', 'lane']) {
    const descriptor = Object.getOwnPropertyDescriptor(row, field);
    if (!descriptor) {
      if (prototype && Object.getOwnPropertyDescriptor(prototype, field)) return null;
      continue;
    }
    if (!Object.hasOwn(descriptor, 'value')) return null;
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

/** Gradient admission copies only plain guard metadata; accessors and inherited records keep their legacy reads. */
export function capturePptxGradientMetadata(row: DesignBoxRowV1): DesignBoxRowV1 | null {
  return capturePptxMetadata(row, true);
}

/** Solid admission inspects descriptors before the legacy gradient reads, never invoking a getter to choose a consumer. */
export function capturePptxSolidMetadata(row: DesignBoxRowV1): DesignBoxRowV1 | null {
  return capturePptxMetadata(row, false);
}

/** Page selection, visibility, notes and all other row families remain with the native producer. */
export function isPptxPrimitiveRow(row: DesignBoxRowV1, origin: { x: number; y: number } = { x: 0, y: 0 }, geometry?: DrawBox, capturedGradient = false, capture?: NativeCapture): boolean {
  if (!['', 'box'].includes(capture?.kind ?? string(row.kind)) || !['', 'rect', 'rounded'].includes(capture?.shapeKind ?? string(row.shape))) return false;
  for (const field of GUARDED_CONTENT) {
    if (field === 'grad' && capturedGradient) continue;
    if (string(row[field]).trim()) return false;
  }
  if (!['', 'none'].includes(string(row.shadow)) || !['', 'normal'].includes(string(row.blend))) return false;
  if (!['', 'solid'].includes(string(row.strokeDash))) return false;
  if (['blur', 'bgBlur', 'rx', 'ry'].some(field => number(row[field]) !== 0)) return false;
  if (row.start != null || row.dur != null || string(row.lane) === 'seq') return false;
  // The old branch still handles values whose EMU conversion exceeds finite arithmetic.
  const coordinates = geometry ?? { x: number(row.x), y: number(row.y), w: number(row.w, 1), h: number(row.h, 1) };
  return [coordinates.x - origin.x, coordinates.y - origin.y, coordinates.w, coordinates.h, capture?.radius ?? number(row.radius), capture?.strokeWidth ?? number(row.strokeW)]
    .every(value => Number.isFinite(emu(value)));
}

function validateLinear(linear: NativeLinear): void {
  if (!Number.isFinite(linear.angle) || linear.stops.length < 2) throw new Error('PPTX gradients need finite native angles and at least two stops.');
  for (const stop of linear.stops) {
    if (!stop || !Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 1) throw new Error('PPTX gradient positions must be in range.');
    validColor(stop.color, stop.opacity);
  }
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
  if (!isPptxPrimitiveRow(row, origin, supplied?.geometry, !!supplied?.linear, supplied?.capture)) throw new Error('This row needs the legacy native PPTX producer.');
  if (!supplied) throw new Error('The PPTX compatibility reading needs resolved paints.');
  validatePaint(supplied.fills, supplied.stroke);
  if (supplied.linear) validateLinear(supplied.linear);
  const capture = supplied.capture;
  if (capture && (![capture.radius, capture.strokeWidth, capture.rotation ?? 0, capture.underlayRotation ?? 0].every(Number.isFinite)
    || !['', 'box'].includes(capture.kind) || !['', 'rect', 'rounded'].includes(capture.shapeKind))) throw new Error('PPTX captured primitive facts are not finite or in range.');
  const rounded = (capture?.shapeKind ?? string(row.shape)) === 'rounded', rot = capture ? capture.rotation ?? 0 : number(row.rot);
  const geometry = supplied.geometry ?? { x: number(row.x), y: number(row.y), w: number(row.w, 1), h: number(row.h, 1) };
  return {
    id: string(row.id), op: 'shape', compatibility: 'pptx-native-v1', nativePptx: { rounded,
      ...(supplied.linear ? { linear: { angle: supplied.linear.angle, stops: supplied.linear.stops.map(stop => ({ ...stop })) },
        ...(capture?.underlayRotation !== undefined ? { underlayRotation: capture.underlayRotation } : {}) } : {}) },
    box: { x: geometry.x - origin.x, y: geometry.y - origin.y,
      w: Math.max(1 / EMU_PER_PX, geometry.w), h: Math.max(1 / EMU_PER_PX, geometry.h) },
    opacity: 100, shape: { kind: 'rect', radius: rounded ? capture?.radius ?? number(row.radius) : 0 },
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
  const native = op.nativePptx as PptxPrimitiveOp['nativePptx'];
  if (native.linear) validateLinear(native.linear);
  if (native.underlayRotation !== undefined && (!native.linear || !Number.isFinite(native.underlayRotation))) throw new Error('PPTX gradient underlay rotation must be finite.');
  const fill = op.fills[0], stroke = op.stroke;
  if (fill && fill.kind !== 'color') throw new Error('PPTX primitive paint must be solid.');
  return {
    kind: 'rect', x: emu(x), y: emu(y), cx: Math.max(1, emu(w)), cy: Math.max(1, emu(h)),
    ...(op.pose?.rot ? { rot: op.pose.rot } : {}),
    ...(native.linear ? { fill: { grad: native.linear.stops.map(stop => ({ pos: stop.offset, color: stop.color.slice(1),
      ...(stop.opacity !== undefined ? { alpha: stop.opacity } : {}) })), angle: native.linear.angle } }
      : fill ? { fill: { solid: fill.color.slice(1), ...(fill.opacity !== undefined ? { alpha: fill.opacity } : {}) } } : {}),
    ...(stroke ? { line: { color: stroke.color.slice(1), w: emu(stroke.width), ...(stroke.opacity !== undefined ? { alpha: stroke.opacity } : {}) } } : {}),
    ...(op.nativePptx.rounded ? { radius: emu(op.shape.radius) } : {}),
  };
}

/** Native gradients paint over an optional solid rectangle; only the top rectangle carries the outline. */
export function designDrawPptxLayers(op: DrawShapeOp): PptxRect[] {
  const top = designDrawPptx(op), native = (op as PptxPrimitiveOp).nativePptx, fill = op.fills[0];
  if (!native.linear || !fill || fill.kind !== 'color') return [top];
  const under: PptxRect = { kind: 'rect', x: top.x, y: top.y, cx: top.cx, cy: top.cy,
    ...(native.underlayRotation ? { rot: native.underlayRotation } : {}),
    ...(native.rounded ? { radius: top.radius } : {}),
    fill: { solid: fill.color.slice(1), ...(fill.opacity !== undefined ? { alpha: fill.opacity } : {}) } };
  return [under, top];
}
