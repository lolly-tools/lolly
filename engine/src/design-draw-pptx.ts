// SPDX-License-Identifier: MPL-2.0
/** The native deck's primitive, linear-gradient and single-path reading, distinct from Design's CSS geometry. */
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { DesignDrawCompileOpts, DrawBox, DrawPaint, DrawShapeOp, DrawStroke } from './design-draw.ts';
import { EMU_PER_PX, type PptxLineEnd, type PptxPath, type PptxRect } from './pptx.ts';
import { type Contour, toSvgPathData } from './geom/path.ts';

type NativeLinear = NonNullable<NonNullable<DesignDrawCompileOpts['pptxCompat']>['linear']>;
type NativeCapture = NonNullable<NonNullable<DesignDrawCompileOpts['pptxCompat']>['capture']>;
type NativePath = NonNullable<NonNullable<DesignDrawCompileOpts['pptxCompat']>['path']>;
/** Presence is significant: the original native result states even a zero or negative rounded radius. */
interface PptxPrimitiveOp extends DrawShapeOp {
  nativePptx: { rounded: boolean; linear?: NativeLinear; underlayRotation?: number };
}
interface PptxPathOp extends DrawShapeOp {
  nativePptx: { path: true; open?: true; head?: PptxLineEnd; tail?: PptxLineEnd };
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

/** Path admission never invokes accessors; inherited and accessor records keep their original lowering. */
export function capturePptxPathMetadata(row: DesignBoxRowV1): DesignBoxRowV1 | null {
  try {
    const prototype = Object.getPrototypeOf(row);
    if (prototype !== null && prototype !== Object.prototype) return null;
    const snapshot: DesignBoxRowV1 = Object.create(null);
    for (const field of Object.getOwnPropertyNames(row)) {
      const descriptor = Object.getOwnPropertyDescriptor(row, field);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      snapshot[field] = descriptor.value;
    }
    if (prototype && ['id', 'hidden', 'kind', 'path', 'bg', 'stroke', 'opacity', 'flipH', 'flipV', 'fillRule', 'x', 'y', 'w', 'h', 'rot', 'strokeW',
      ...GUARDED_CONTENT, 'shadow', 'blend', 'strokeDash', 'blur', 'bgBlur', 'rx', 'ry', 'start', 'dur', 'lane']
      .some(field => !Object.hasOwn(snapshot, field) && Object.getOwnPropertyDescriptor(prototype, field))) return null;
    return snapshot;
  } catch {
    return null;
  }
}

const NATIVE_HEADS: Readonly<Record<string, PptxLineEnd>> = { triangle: 'triangle', open: 'arrow', circle: 'oval', diamond: 'diamond' };

function finiteSinglePath(contours: Contour[], open = false): boolean {
  return Array.isArray(contours) && contours.length === 1 && contours[0]?.closed === !open
    && Array.isArray(contours[0].curves) && contours[0].curves.length > 0
    && Array.from(contours[0].curves).every(curve => Array.isArray(curve) && curve.length === 8 && Array.from(curve).every(Number.isFinite));
}

function finiteNativePath(path: NativePath): boolean {
  return (path.open === undefined || path.open === true) && finiteSinglePath(path.contours, path.open === true)
    && [path.head, path.tail].every(end => end === undefined || (path.open === true && Object.values(NATIVE_HEADS).includes(end)));
}

/** Only one finite contour with solid paint and already-supported native ends enters this reading. */
export function isPptxPathRow(row: DesignBoxRowV1, origin: { x: number; y: number } = { x: 0, y: 0 }, geometry?: DrawBox, path?: NativePath): boolean {
  const metadata = capturePptxPathMetadata(row);
  if (!metadata || string(metadata.kind) !== 'path' || !path || !finiteNativePath(path)
    || !Number.isFinite(path.rotation ?? 0)) return false;
  for (const field of GUARDED_CONTENT) {
    if (field === 'path') continue;
    if (path.open === true && (field === 'headStart' || field === 'headEnd')) {
      const authored = string(metadata[field]), resolved = Object.hasOwn(NATIVE_HEADS, authored) ? NATIVE_HEADS[authored] : undefined;
      if ((authored.trim() && resolved === undefined) || path[field === 'headStart' ? 'head' : 'tail'] !== resolved) return false;
    } else if (string(metadata[field]).trim()) return false;
  }
  if (!['', 'none'].includes(string(metadata.shadow)) || !['', 'normal'].includes(string(metadata.blend))
    || !['', 'solid'].includes(string(metadata.strokeDash)) || !['', 'nonzero'].includes(string(metadata.fillRule))) return false;
  if (['blur', 'bgBlur', 'rx', 'ry'].some(field => number(metadata[field]) !== 0)
    || metadata.start != null || metadata.dur != null || string(metadata.lane) === 'seq') return false;
  const coordinates = geometry ?? { x: number(metadata.x), y: number(metadata.y), w: number(metadata.w, 1), h: number(metadata.h, 1) };
  return [coordinates.x - origin.x, coordinates.y - origin.y, coordinates.w, coordinates.h, number(metadata.strokeW)]
    .every(value => Number.isFinite(emu(value)));
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

/** Keep the producer's quantized, mirrored EMU cubics detached from authored state and callback inputs. */
export function compilePptxCompatPathRow(row: DesignBoxRowV1, origin: { x: number; y: number }, supplied: DesignDrawCompileOpts['pptxCompat']): PptxPathOp {
  if (!supplied?.path || supplied.linear || supplied.capture || !isPptxPathRow(row, origin, supplied.geometry, supplied.path)) {
    throw new Error('This path needs the legacy native PPTX producer.');
  }
  validatePaint(supplied.fills, supplied.stroke);
  if ((supplied.path.head !== undefined || supplied.path.tail !== undefined) && !supplied.stroke) throw new Error('Native PPTX ends need an open stroked path.');
  const geometry = supplied.geometry ?? { x: number(row.x), y: number(row.y), w: number(row.w, 1), h: number(row.h, 1) };
  const rotation = supplied.path.rotation ?? 0;
  return {
    id: string(row.id), op: 'shape', compatibility: 'pptx-native-v1', nativePptx: { path: true, ...(supplied.path.open ? { open: true } : {}),
      ...(supplied.path.head ? { head: supplied.path.head } : {}), ...(supplied.path.tail ? { tail: supplied.path.tail } : {}) },
    box: { x: geometry.x - origin.x, y: geometry.y - origin.y,
      w: Math.max(1 / EMU_PER_PX, geometry.w), h: Math.max(1 / EMU_PER_PX, geometry.h) },
    opacity: 100,
    shape: { kind: 'path', evenOdd: false, contours: supplied.path.contours.map(contour => ({
      closed: contour.closed, curves: contour.curves.map(curve => [...curve]),
    })) },
    ...(rotation !== 0 ? { pose: { rot: rotation, flipH: false, flipV: false } } : {}),
    fills: supplied.fills.map(fill => ({ ...fill })),
    ...(supplied.stroke ? { stroke: { ...supplied.stroke } } : {}),
  };
}

/** Serialize only evaluated native EMU contours, with the original one-decimal SVG path reading. */
export function designDrawPptxPath(op: DrawShapeOp): PptxPath {
  if (op.compatibility !== 'pptx-native-v1' || !('nativePptx' in op) || !op.nativePptx
    || typeof op.nativePptx !== 'object' || !Object.hasOwn(op.nativePptx, 'path') || !('path' in op.nativePptx)
    || op.nativePptx.path !== true) throw new Error('PPTX needs its named native-path compatibility reading.');
  const native = op.nativePptx as PptxPathOp['nativePptx'];
  const fields = Object.keys(native);
  if (native.open === undefined ? fields.length !== 1 : native.open !== true || !Object.hasOwn(native, 'open')
    || fields.some(field => !['path', 'open', 'head', 'tail'].includes(field))) throw new Error('PPTX path metadata contains unsupported content.');
  if (['head', 'tail'].some(field => Object.hasOwn(native, field) ? native[field as 'head' | 'tail'] === undefined : native[field as 'head' | 'tail'] !== undefined)
    || !finiteNativePath({ contours: op.shape.kind === 'path' ? op.shape.contours : [], open: native.open, head: native.head, tail: native.tail })
    || ((native.head !== undefined || native.tail !== undefined) && !op.stroke)) throw new Error('Native PPTX ends need an open stroked path.');
  if (op.words || op.picture || op.clip || op.blend || op.shadow || op.blur || op.outline || op.fillRule
    || op.pose?.flipH || op.pose?.flipV || op.shape.kind !== 'path' || op.shape.evenOdd || op.shape.commands || op.opacity !== 100
    || !finiteSinglePath(op.shape.contours, native.open === true)) throw new Error('PPTX native-path evaluation contains unsupported content.');
  const { x, y, w, h } = op.box;
  if (![x, y, w, h, op.pose?.rot ?? 0].every(Number.isFinite) || w < 1 / EMU_PER_PX || h < 1 / EMU_PER_PX
    || ![x, y, w, h].every(value => Number.isFinite(emu(value)))) throw new Error('PPTX path geometry is not finite or in range.');
  validatePaint(op.fills, op.stroke);
  const fill = op.fills[0], stroke = op.stroke;
  if (fill && fill.kind !== 'color') throw new Error('PPTX path paint must be solid.');
  return {
    kind: 'path', x: emu(x), y: emu(y), cx: Math.max(1, emu(w)), cy: Math.max(1, emu(h)),
    ...(op.pose?.rot ? { rot: op.pose.rot } : {}),
    paths: [{ d: toSvgPathData(op.shape.contours, 1) }],
    ...(fill ? { fill: { solid: fill.color.slice(1), ...(fill.opacity !== undefined ? { alpha: fill.opacity } : {}) } } : {}),
    ...(stroke ? { line: { color: stroke.color.slice(1), w: emu(stroke.width), ...(stroke.opacity !== undefined ? { alpha: stroke.opacity } : {}),
      ...(native.head ? { head: native.head } : {}), ...(native.tail ? { tail: native.tail } : {}) } } : {}),
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
