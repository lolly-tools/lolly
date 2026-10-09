// SPDX-License-Identifier: MPL-2.0
/** The internal legacy dotLottie vector reading and its operation consumer.
 * Compilation receives resolved paint and the existing pure geometry authority;
 * emission reads only the evaluated operations, with no row, host or asset IO. */
import type { DrawPaint, DrawShapeOp, DrawShape, DrawBox, DesignDrawCompileOpts } from './design-draw.ts';
import type { DesignBoxRowV1, GeomAPI } from '@lolly-tools/core';
import { pathFromSubPaths } from './geom/path.ts';
import { parseSvgPath, type SubPath } from './svg-path.ts';
import { parseColorToSrgb8 } from './css-color.ts';
import { lottieStatic as fixed } from './lottie-sequence.ts';
import type { LottieObject } from './lottie-model.ts';

/** Numeric coercion of the existing dotLottie export, distinct from CSS leading-number reading. */
export const lottieCompatNumber = (value: unknown, fallback = 0): number => value === '' || value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);

const lottieCompatFlag = (value: unknown): boolean => value === true || value === 'true' || value === '1' || value === 1;

export function admitDesignLottieRow(box: Record<string, unknown>): void {
  const name = String(box.name || box.id || 'Layer');
  const fail = (feature: string) => { throw new Error(`${name}: ${feature} is not supported by dotLottie export. Remove it or export video.`); };
  if (String(box.text ?? '').trim() || box.kind === 'text') fail('text');
  if (box.pathPaint) fail('independent vector paint');
  if (box.kind === 'audio' || box.kind === 'camera' || box.kind === '3d') fail(String(box.kind));
  if (box.kind && !['box', 'path', 'image', 'frame'].includes(String(box.kind))) fail(String(box.kind));
  for (const field of ['grad', 'clip', 'bindStart', 'bindEnd', 'cls']) if (box[field]) fail(field);
  for (const field of ['blur', 'bgBlur', 'z', 'rx', 'ry']) if (lottieCompatNumber(box[field])) fail(field);
  for (const field of ['shadow', 'blend', 'enter', 'exit', 'hold', 'headStart', 'headEnd', 'split']) if (box[field] && box[field] !== 'none' && box[field] !== 'normal') fail(field);
  if (lottieCompatFlag(box.flipH) || lottieCompatFlag(box.flipV)) fail('mirroring');
  if (lottieCompatNumber(box.strokeW) > 0 && ((box.strokeDash && box.strokeDash !== 'solid') || box.strokeDashArray)) fail('dashed strokes');
}
function lottieResolvedPaint(rgba: readonly number[] | null): DrawPaint | null {
  if (rgba === null) return null;
  if (rgba.length !== 4 || rgba.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 1)) throw new Error('The Lottie compatibility reading needs resolved sRGB paint.');
  return { kind: 'color', color: `#${rgba.slice(0, 3).map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`, opacity: rgba[3]! };
}

/** Preserve the admitted legacy vector interpretation without changing Design or preview semantics. */
export function compileLottieCompatRow(row: DesignBoxRowV1, offset: { x: number; y: number }, supplied: DesignDrawCompileOpts['lottieCompat']): DrawShapeOp {
  if (!supplied) throw new Error('The Lottie compatibility reading needs resolved paints.');
  admitDesignLottieRow(row);
  const box = { x: Math.round(lottieCompatNumber(row.x)) - offset.x, y: Math.round(lottieCompatNumber(row.y)) - offset.y,
    w: Math.max(1, Math.round(lottieCompatNumber(row.w, 1))), h: Math.max(1, Math.round(lottieCompatNumber(row.h, 1))) };
  const fill = lottieResolvedPaint(supplied.fill), ink = lottieResolvedPaint(supplied.stroke);
  const width = ink ? Math.max(0, lottieCompatNumber(row.strokeW)) : 0;
  let shape: DrawShape;
  if (row.kind === 'path') {
    const commands = lottieCompatPaths(row, box, supplied.geom);
    const contours = pathFromSubPaths(commands).map(contour => ({ ...contour, curves: contour.curves.map(curve => curve.map((n, index) => n + (index % 2 === 0 ? box.x : box.y)) as typeof curve) }));
    shape = { kind: 'path', contours, commands, evenOdd: row.fillRule === 'evenodd' };
  } else {
    const name = String(row.shape ?? '');
    if (!['rect', 'rounded', 'pill', 'circle', 'ellipse', ''].includes(name)) throw new Error(`${String(row.id)}: unsupported shape ${String(row.shape)}.`);
    shape = row.shape === 'circle' || row.shape === 'ellipse' ? { kind: 'ellipse' } : { kind: 'rect',
      radius: row.shape === 'pill' ? Math.min(box.w, box.h) / 2 : row.shape === 'rounded' ? Math.max(0, lottieCompatNumber(row.radius, 16) - width / 2) : 0 };
  }
  const rot = Math.round(lottieCompatNumber(row.rot) * 10) / 10;
  const emptyPath = row.kind === 'path' && !row.path;
  return { id: String(row.id ?? ''), op: 'shape', compatibility: 'lottie-native-v1', box, shape,
    opacity: Math.min(100, Math.max(0, lottieCompatNumber(row.opacity, 100))),
    ...(rot ? { pose: { rot, flipH: false, flipV: false } } : {}),
    fills: fill && !emptyPath ? [fill] : [],
    ...(row.kind !== 'path' && row.fillRule === 'evenodd' ? { fillRule: 'evenodd' as const } : {}),
    ...(ink?.kind === 'color' && width && !emptyPath ? { stroke: { color: ink.color, opacity: ink.opacity, width,
      cap: row.strokeCap === 'round' ? 'round' : row.strokeCap === 'square' ? 'square' : 'butt',
      join: row.strokeJoin === 'round' ? 'round' : row.strokeJoin === 'bevel' ? 'bevel' : 'miter' } } : {}),
  };
}

/** Retain the host's exact path admission, failure text and three-decimal command stream. */
function lottieCompatPaths(row: DesignBoxRowV1, box: DrawBox, geom: GeomAPI | undefined): SubPath[] {
  if (!row.path) return [];
  if (!geom) throw new Error('dotLottie path export needs host.geom.');
  const decoded = geom.decodeAuthored(String(row.path));
  if (!decoded.ok) throw new Error(`Path ${String(row.id)}: ${decoded.message}`);
  const commands: SubPath[] = [];
  for (const source of decoded.value) {
    const nodes = source.nodes.map(node => ({ ...node, x: node.x * box.w, y: node.y * box.h,
      ...(node.hInX !== undefined ? { hInX: node.hInX * box.w } : {}), ...(node.hInY !== undefined ? { hInY: node.hInY * box.h } : {}),
      ...(node.hOutX !== undefined ? { hOutX: node.hOutX * box.w } : {}), ...(node.hOutY !== undefined ? { hOutY: node.hOutY * box.h } : {}),
    }));
    const result = geom.fromNodes({ ...source, nodes, decimals: 3 });
    if (!result.ok) throw new Error(`Path ${String(row.id)}: ${result.message}`);
    commands.push(...parseSvgPath(result.d));
  }
  return commands;
}

function color(paint: DrawPaint): number[] {
  if (paint.kind !== 'color') throw new Error('dotLottie vector paint must be solid.');
  const rgba = parseColorToSrgb8(paint.color);
  if (!rgba) throw new Error('dotLottie vector paint was not resolved.');
  return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, paint.opacity ?? rgba[3]];
}

export function designDrawLottie(op: DrawShapeOp): LottieObject[] {
  if (op.compatibility !== 'lottie-native-v1') throw new Error('dotLottie needs the named native-vector compatibility reading.');
  if (op.words || op.picture || op.clip || op.blend || op.shadow || op.blur || op.pose?.flipH || op.pose?.flipV) throw new Error('dotLottie native-vector evaluation contains unsupported content.');
  const out: LottieObject[] = [];
  const stroke = op.stroke;
  const width = stroke?.width ?? 0;
  if (op.shape.kind === 'path') {
    if (!op.shape.commands) throw new Error('dotLottie needs the evaluated compatibility path commands.');
    for (const path of op.shape.commands) {
      const vertices: number[][] = [], incoming: number[][] = [], outgoing: number[][] = [];
      for (const segment of path.segments) {
        if (segment.op === 'C') {
          const previous = vertices.at(-1)!;
          outgoing[outgoing.length - 1] = [segment.x1 - previous[0]!, segment.y1 - previous[1]!];
        }
        vertices.push([segment.x, segment.y]);
        incoming.push(segment.op === 'C' ? [segment.x2 - segment.x, segment.y2 - segment.y] : [0, 0]);
        outgoing.push([0, 0]);
      }
      out.push({ ty: 'sh', ks: fixed({ v: vertices, i: incoming, o: outgoing, c: path.closed }) });
    }
  } else {
    const ellipse = op.shape.kind === 'ellipse';
    out.push({ ty: ellipse ? 'el' : 'rc', p: fixed([op.box.w / 2, op.box.h / 2]),
      s: fixed([Math.max(0, op.box.w - width), Math.max(0, op.box.h - width)]),
      ...(op.shape.kind === 'rect' ? { r: fixed(op.shape.radius) } : {}), d: 1 });
  }
  for (const fill of op.fills) {
    const rgba = color(fill);
    out.push({ ty: 'fl', c: fixed(rgba), o: fixed(rgba[3]! * 100), r: (op.shape.kind === 'path' ? op.shape.evenOdd : op.fillRule === 'evenodd') ? 2 : 1 });
  }
  if (stroke) {
    const rgba = color({ kind: 'color', color: stroke.color, opacity: stroke.opacity });
    out.push({ ty: 'st', c: fixed(rgba), o: fixed(rgba[3]! * 100), w: fixed(width),
      lc: stroke.cap === 'round' ? 2 : stroke.cap === 'square' ? 3 : 1,
      lj: stroke.join === 'round' ? 2 : stroke.join === 'bevel' ? 3 : 1, ml: 4 });
  }
  return out;
}
