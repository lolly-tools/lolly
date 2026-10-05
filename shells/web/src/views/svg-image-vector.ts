// SPDX-License-Identifier: MPL-2.0
/** Inline image placement becomes authored geometry without moving its painted ink. */
import { importVectorPaint, vectorContourNodes } from '../../../../engine/src/vector-paint-import.ts';
import { CSS_DPI, parseDimension, toInches } from '../../../../engine/src/units.ts';
import { splitVectorPaint } from '../../../../engine/src/vector-paint-parts.ts';
import { multiplyVectorMatrix, transformVectorPaintPaths, type VectorPaintV1 } from '../../../../engine/src/vector-paint.ts';
import { decodeAuthoredPathsResult, encodeAuthoredPaths } from '../../../../engine/src/geom/authored-url.ts';
import { pathBounds, pathFromSubPaths } from '../../../../engine/src/geom/path.ts';
import { parseSvgPath } from '../../../../engine/src/svg-path.ts';
import { toCubics } from '../../../../engine/src/geom/spline.ts';
import { editableVectorPart } from './text-vector-parts.ts';
import { inlineSvgImageStyles } from './svg-image-styles.ts';
import type { Box, VectorFieldConfig } from './vector-ops.ts';

export interface SvgImageFields extends VectorFieldConfig { imageField?: string; fitField?: string; imgPosField?: string; textField?: string; gradField?: string; shadowField?: string }
const truth = (value: unknown): boolean => [true, 'true', 1, '1'].includes(value as string | number | boolean);
const round = (value: unknown, fallback: number): number => Math.round(Number.isFinite(Number(value)) ? Number(value) : fallback);
const finite = (value: unknown, fallback: number): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const parser = (source: string): Document => new DOMParser().parseFromString(source, 'image/svg+xml');
function size(value: string | null, fallback: number): number {
  if (!value || value === '100%') return fallback;
  const dimension = parseDimension(value);
  if (!dimension || dimension.value <= 0) throw new Error('This SVG has unsupported intrinsic dimensions.');
  return dimension.unit === 'px' ? dimension.value : toInches(dimension) * CSS_DPI;
}
function anchor(value: string): [number, number] {
  const choices: Record<string, [number, number]> = { center:[.5,.5], top:[.5,0], bottom:[.5,1], left:[0,.5], right:[1,.5],
    'center top':[.5,0], 'center bottom':[.5,1], 'left center':[0,.5], 'right center':[1,.5], 'left top':[0,0], 'right top':[1,0], 'left bottom':[0,1], 'right bottom':[1,1] };
  return choices[value] ?? [.5,.5];
}
function clipPart(part: {path: string; paint: VectorPaintV1}, d: string): void {
  const decoded = decodeAuthoredPathsResult(part.path);
  if (!Array.isArray(decoded)) throw new Error('The SVG has invalid editable geometry.');
  const id = 'image-viewport-' + crypto.randomUUID(), indices: number[] = [];
  for (const contour of pathFromSubPaths(parseSvgPath(d))) {
    indices.push(decoded.length); decoded.push(vectorContourNodes(contour, 1, 1));
  }
  part.path = encodeAuthoredPaths(decoded);
  part.paint = { ...part.paint, root:{tag:'g',attributes:{},children:[
    {tag:'defs',attributes:{},children:[{tag:'clipPath',attributes:{id,clipPathUnits:'userSpaceOnUse'},children:[{tag:'path',attributes:{},contours:indices}]}]},
    {tag:'g',attributes:{'clip-path':`url(#${id})`},children:[part.paint.root]},
  ]} };
}
/** Every output contains editable paths; unsupported artwork throws before any write. */
export function svgImagePaths(markup: string, source: Box, cfg: SvgImageFields): Box[] {
  if (markup.length > 1_000_000) throw new Error('This SVG is too large to unpack into editable paths.');
  if (truth(source.locked)) throw new Error('Unlock this image before unpacking its layers.');
  if (source.linkOf || source[cfg.clipField ?? 'clip']) throw new Error('Remove this image’s media link or clipping reference before unpacking it.');
  if (source[cfg.textField ?? 'text'] || source.textStory) throw new Error('Separate this image’s text before unpacking its layers.');
  if (Number(source.blur) || Number(source.bgBlur) || source[cfg.shadowField ?? 'shadow'] && source[cfg.shadowField ?? 'shadow'] !== 'none'
    || Number(source[cfg.strokeWField ?? 'strokeW']) || source[cfg.gradField ?? 'grad'] || source.kf) throw new Error('Remove the image’s border, effects and keyframes before unpacking its layers.');
  const bg = String(source[cfg.fillField ?? 'bg'] ?? '');
  if (bg && !['none','transparent'].includes(bg)) throw new Error('Remove the image’s background fill before unpacking its layers.');
  const doc = parser(markup), root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('This image is not a readable SVG.');
  for (const element of root.querySelectorAll('metadata,title,desc')) element.remove();
  for (const element of [root, ...root.querySelectorAll('*')]) for (const attribute of [...element.attributes]) {
    if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-') || ['role','focusable'].includes(attribute.name)
      || attribute.name.startsWith('inkscape:') || attribute.name.startsWith('sodipodi:') || attribute.name.startsWith('xmlns:inkscape') || attribute.name.startsWith('xmlns:sodipodi')) element.removeAttribute(attribute.name);
  }
  inlineSvgImageStyles(root);
  const view = root.hasAttribute('viewBox') ? root.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number)
    : [0,0,size(root.getAttribute('width'),NaN),size(root.getAttribute('height'),NaN)];
  if (view.length !== 4 || view.some(value => !Number.isFinite(value)) || view[2]! <= 0 || view[3]! <= 0) throw new Error('This SVG needs a finite viewBox before its layers can be unpacked.');
  const width = root.getAttribute('width'), height = root.getAttribute('height');
  const fixedWidth = !!width && width !== '100%', fixedHeight = !!height && height !== '100%';
  const baseW = size(width, view[2]!), baseH = size(height, view[3]!);
  const iw = !fixedWidth && fixedHeight ? baseH*view[2]!/view[3]! : baseW;
  const ih = !fixedHeight && fixedWidth ? baseW*view[3]!/view[2]! : baseH;
  root.setAttribute('viewBox',view.join(' '));
  const ratio = root.getAttribute('preserveAspectRatio')?.trim() || 'xMidYMid meet';
  const match = /^(none|x(Min|Mid|Max)Y(Min|Mid|Max))(?:\s+(meet|slice))?$/.exec(ratio);
  if (!match) throw new Error('This SVG has unsupported viewport alignment.');
  root.removeAttribute('preserveAspectRatio'); root.removeAttribute('width'); root.removeAttribute('height');
  const vector = importVectorPaint(new XMLSerializer().serializeToString(root), parser);
  const w = Math.max(1, round(source[cfg.wField ?? 'w'], 1)), h = Math.max(1, round(source[cfg.hField ?? 'h'], 1));
  const innerScale = match[4] === 'slice' ? Math.max(iw / view[2]!, ih / view[3]!) : Math.min(iw / view[2]!, ih / view[3]!);
  const sx = match[1] === 'none' ? iw / view[2]! : innerScale, sy = match[1] === 'none' ? ih / view[3]! : innerScale;
  const align = (value: string | undefined): number => value === 'Min' ? 0 : value === 'Max' ? 1 : .5;
  const ix = (iw - view[2]! * sx) * align(match[2]), iy = (ih - view[3]! * sy) * align(match[3]);
  const fit = String(source[cfg.fitField ?? 'fit'] ?? 'contain');
  let ox = 1, oy = 1;
  if (fit === 'fill') { ox = w / iw; oy = h / ih; }
  else if (fit !== 'none') { ox = oy = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih, fit === 'scale-down' ? 1 : Infinity); }
  let [ax, ay] = anchor(String(source[cfg.imgPosField ?? 'imgpos'] ?? 'center'));
  const framing = source.imageFraming as { x?: number; y?: number; zoom?: number } | undefined;
  if (framing) { ax = Math.max(0, Math.min(100, finite(framing.x,50))) / 100; ay = Math.max(0, Math.min(100, finite(framing.y,50))) / 100; }
  const zoom = framing ? Math.max(1, finite(framing.zoom,100)) / 100 : 1;
  const placement = multiplyVectorMatrix([zoom,0,0,zoom,(1-zoom)*w*ax,(1-zoom)*h*ay], [ox*sx,0,0,oy*sy,(w-iw*ox)*ax+ox*ix,(h-ih*oy)*ay+oy*iy]);
  const matrix = multiplyVectorMatrix([view[2]!/w,0,0,view[3]!/h,0,0], placement);
  vector.paint.root = { tag:'g', attributes:{ transform:`matrix(${matrix.join(' ')})` }, children:[vector.paint.root] };
  const opacity = Math.max(0, Math.min(100, finite(source[cfg.opacityField ?? 'opacity'],100)));
  const blend = String(source[cfg.blendField ?? 'blend'] ?? '');
  // Group alpha and blending cannot be distributed across overlapping paint layers.
  const entrance = [source.enter,source.exit].some(value=>value&&value!=='none');
  const composite = opacity !== 100 || !!blend && blend !== 'normal' || entrance;
  const parts = composite ? [vector] : splitVectorPaint(vector.path, vector.paint, true);
  // The original replaced image clips its SVG viewport as well as its box.
  const imageLeft = (w-iw*ox*zoom)*ax/w, imageTop = (h-ih*oy*zoom)*ay/h;
  const left = Math.max(0, imageLeft), top = Math.max(0, imageTop);
  const right = Math.min(1, imageLeft + iw*ox*zoom/w), bottom = Math.min(1, imageTop + ih*oy*zoom/h);
  const shape = String(source[cfg.shapeField ?? 'shape'] ?? 'rect');
  const radius = shape === 'pill' ? Math.min(w,h)/2 : shape === 'rounded' ? Math.min(Math.min(w,h)/2, Math.max(0, Number(source[cfg.radiusField ?? 'radius']) || 0)) : 0;
  return parts.map(part => {
    const decoded = decodeAuthoredPathsResult(part.path);
    if (!Array.isArray(decoded)) throw new Error('The SVG has invalid editable geometry.');
    const visible = transformVectorPaintPaths(decoded, part.paint);
    const bounds = pathBounds(visible.map(path => ({ closed:path.closed, curves:toCubics(path) })));
    const strokes = /"stroke":"(?!none")/.test(JSON.stringify(part.paint.root));
    if (strokes || !bounds || bounds.x0 < left-1e-6 || bounds.y0 < top-1e-6 || bounds.x1 > right+1e-6 || bounds.y1 > bottom+1e-6) clipPart(part, `M${left} ${top}H${right}V${bottom}H${left}Z`);
    if (shape === 'ellipse' || shape === 'circle' || radius) {
      const ellipse = shape === 'ellipse' || shape === 'circle', rx = radius/w, ry = radius/h;
      const d = ellipse ? `M0 .5A.5 .5 0 1 1 1 .5A.5 .5 0 1 1 0 .5Z`
        : rx && ry ? `M${rx} 0H${1-rx}A${rx} ${ry} 0 0 1 1 ${ry}V${1-ry}A${rx} ${ry} 0 0 1 ${1-rx} 1H${rx}A${rx} ${ry} 0 0 1 0 ${1-ry}V${ry}A${rx} ${ry} 0 0 1 ${rx} 0Z` : 'M0 0H1V1H0Z';
      clipPart(part, d);
    }
    const fields = { [cfg.kindField ?? 'kind']:'path', [cfg.imageField ?? 'image']:'', [cfg.textField ?? 'text']:'', [cfg.fillField ?? 'bg']:'none',
      [cfg.gradField ?? 'grad']:'', [cfg.strokeField ?? 'stroke']:'', [cfg.strokeWField ?? 'strokeW']:0, [cfg.shapeField ?? 'shape']:'rect', [cfg.radiusField ?? 'radius']:0, imageFraming:undefined };
    const made = { ...source, ...fields, [cfg.opacityField ?? 'opacity']:opacity, [cfg.pathField ?? 'path']:part.path, pathPaint:JSON.stringify(part.paint) };
    return composite ? made : editableVectorPart(made, part, cfg);
  });
}
