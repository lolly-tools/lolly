// SPDX-License-Identifier: MPL-2.0
/**
 * Fidelity fixtures for the drawing compiler (plan 295, phase 3): static Design pages
 * rendered by the real Design tool and by the compiled SVG, compared region by region.
 */
import { encodeAuthoredPaths } from '../../engine/src/geom/authored-url.ts';
import { encodePng, type Rgba } from './studio3d-glb.ts';

type Row = Record<string, unknown>;
const path = (closed: boolean, nodes: Array<Record<string, number>>) => encodeAuthoredPaths([{ kind: 'cubic', closed, nodes }] as never) ?? '';
const triangle = path(true, [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }]);
const wave = path(false, [{ x: 0, y: 0.5, hOutX: 0.2, hOutY: -0.5 }, { x: 0.5, y: 0.5, hInX: -0.2, hInY: 0.5, hOutX: 0.2, hOutY: -0.5 }, { x: 1, y: 0.5, hInX: -0.2, hInY: 0.5 }]);
const ring = encodeAuthoredPaths([
  { kind: 'cubic', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  { kind: 'cubic', closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }] },
] as never) ?? '';

export interface FidelityPage { name: string; width: number; height: number; rows: Row[] }

/** A picture both sides can draw: the URL the Design tool and the compiled SVG load, and its own size. */
export interface FidelityPicture { url: string; type: string; width: number; height: number }

/**
 * The fixture pictures: two rasters with hard quadrants, a border and a diagonal, so a
 * crop, a shift or a stretch moves visible edges, and a vector with its own size.
 */
export function fidelityPictures(): Record<string, FidelityPicture> {
  const png = (width: number, height: number, pixel: (x: number, y: number) => Rgba): FidelityPicture =>
    ({ url: `data:image/png;base64,${Buffer.from(encodePng(width, height, pixel)).toString('base64')}`, type: 'image', width, height });
  const quadrants: Rgba[] = [[224, 49, 49, 255], [25, 113, 194, 255], [47, 158, 68, 255], [240, 140, 0, 255]];
  const vector = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#5f3dc4"/><circle cx="40" cy="40" r="30" fill="#fcc419"/><rect x="70" y="10" width="40" height="60" fill="#20c997"/></svg>';
  return {
    'fixture/wide': png(160, 80, (x, y) => {
      if (x < 3 || y < 3 || x >= 157 || y >= 77) return [33, 37, 41, 255];
      if (Math.abs(x / 2 - y) < 3) return [255, 255, 255, 255];
      return quadrants[(x < 80 ? 0 : 1) + (y < 40 ? 0 : 2)]!;
    }),
    'fixture/tall': png(60, 120, (_x, y) => (y < 3 || y >= 117 ? [33, 37, 41, 255] : quadrants[Math.min(3, Math.floor(y / 30))]!)),
    'fixture/vector': { url: `data:image/svg+xml;base64,${Buffer.from(vector).toString('base64')}`, type: 'vector', width: 120, height: 80 },
  };
}

/** Pages for shapes, paths, effects, text, pictures and the frame's own paint. */
export function fidelityPages(): FidelityPage[] {
  const frame = (id: string, extra: Row = {}): Row => ({ id, kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0, ...extra });
  const on = (id: string, row: Row): Row => ({ frame: id, ...row });
  return [
    {
      name: 'shapes', width: 640, height: 400,
      rows: [
        frame('shapes'),
        on('shapes', { id: 'rect', kind: 'box', x: 20, y: 20, w: 120, h: 70, bg: '#d9480f' }),
        on('shapes', { id: 'rect-radius', kind: 'box', x: 160, y: 20, w: 120, h: 70, bg: '#1c7ed6', radius: 18 }),
        on('shapes', { id: 'rounded', kind: 'box', x: 300, y: 20, w: 120, h: 70, bg: '#2b8a3e', shape: 'rounded', radius: 18 }),
        on('shapes', { id: 'pill', kind: 'box', x: 440, y: 20, w: 160, h: 60, bg: '#862e9c', shape: 'pill' }),
        on('shapes', { id: 'ellipse', kind: 'box', x: 20, y: 120, w: 140, h: 80, bg: '#e8590c', shape: 'ellipse' }),
        on('shapes', { id: 'circle', kind: 'box', x: 190, y: 110, w: 100, h: 100, bg: '#0b7285', shape: 'circle' }),
        on('shapes', { id: 'border', kind: 'box', x: 320, y: 120, w: 120, h: 80, bg: '#ffe066', stroke: '#212529', strokeW: 8 }),
        on('shapes', { id: 'border-round', kind: 'box', x: 470, y: 120, w: 130, h: 80, bg: '#ffffff', stroke: '#c92a2a', strokeW: 6, shape: 'rounded', radius: 20 }),
        on('shapes', { id: 'faded', kind: 'box', x: 20, y: 240, w: 120, h: 80, bg: '#364fc7', opacity: 40 }),
        on('shapes', { id: 'turned', kind: 'box', x: 180, y: 240, w: 120, h: 70, bg: '#5c940d', rot: 25 }),
        on('shapes', { id: 'linear', kind: 'box', x: 330, y: 240, w: 130, h: 90, grad: 'lin.srgb_90_ff6b6b-0_4dabf7-100' }),
        on('shapes', { id: 'radial', kind: 'box', x: 480, y: 240, w: 130, h: 90, bg: '#212529', grad: 'rad.srgb_0_ffffff-0_ffffff00-100', shape: 'rounded', radius: 12 }),
      ],
    },
    {
      name: 'paths', width: 640, height: 400,
      rows: [
        frame('paths', { bg: '#ffffff' }),
        on('paths', { id: 'triangle', kind: 'path', x: 30, y: 30, w: 160, h: 140, path: triangle, bg: '#f03e3e' }),
        on('paths', { id: 'outlined', kind: 'path', x: 230, y: 30, w: 160, h: 140, path: triangle, bg: '#ffd43b', stroke: '#1864ab', strokeW: 6 }),
        on('paths', { id: 'wave', kind: 'path', x: 430, y: 40, w: 180, h: 120, path: wave, stroke: '#2f9e44', strokeW: 8 }),
        on('paths', { id: 'ring', kind: 'path', x: 40, y: 220, w: 150, h: 150, path: ring, bg: '#7048e8', fillRule: 'evenodd' }),
        on('paths', { id: 'dashed', kind: 'path', x: 240, y: 230, w: 160, h: 120, path: wave, stroke: '#e64980', strokeW: 6, strokeDash: 'dashed' }),
        on('paths', { id: 'flipped', kind: 'path', x: 440, y: 220, w: 160, h: 140, path: triangle, bg: '#12b886', flipV: true, rot: 15 }),
      ],
    },
    {
      name: 'effects', width: 640, height: 400,
      rows: [
        frame('effects', { bg: '#e9ecef' }),
        on('effects', { id: 'mask', kind: 'box', x: 40, y: 40, w: 140, h: 140, bg: '#adb5bd', shape: 'circle' }),
        on('effects', { id: 'clipped', kind: 'box', x: 20, y: 20, w: 200, h: 120, bg: '#d6336c', clip: 'mask' }),
        on('effects', { id: 'under', kind: 'box', x: 260, y: 30, w: 160, h: 120, bg: '#fab005' }),
        on('effects', { id: 'multiply', kind: 'box', x: 320, y: 70, w: 160, h: 120, bg: '#4c6ef5', blend: 'multiply' }),
        on('effects', { id: 'box-shadow', kind: 'box', x: 40, y: 240, w: 140, h: 100, bg: '#ffffff', shape: 'rounded', radius: 14, shadow: 'box', shadowX: 6, shadowY: 10, shadowBlur: 16, shadowColor: '#00000066' }),
        on('effects', { id: 'drop', kind: 'path', x: 230, y: 230, w: 140, h: 120, path: triangle, bg: '#20c997', shadow: 'content', shadowX: 0, shadowY: 8, shadowBlur: 6 }),
        on('effects', { id: 'depth', kind: 'box', x: 420, y: 230, w: 120, h: 90, bg: '#ffffff', shadow: 'depth', z: 40 }),
        on('effects', { id: 'blurred', kind: 'box', x: 560, y: 40, w: 60, h: 140, bg: '#e03131', blur: 4 }),
      ],
    },
    {
      name: 'text', width: 640, height: 400,
      rows: [
        frame('text', { bg: '#ffffff' }),
        on('text', { id: 'default', kind: 'text', x: 20, y: 20, w: 280, h: 80, text: 'Design' }),
        on('text', { id: 'left-top', kind: 'text', x: 320, y: 20, w: 300, h: 110, text: 'Left and top, wrapping onto more lines', fontSize: 22, align: 'left', valign: 'top', weight: 400 }),
        on('text', { id: 'rich', kind: 'text', x: 20, y: 120, w: 280, h: 120, text: 'Plain **bold** *italic* {#d6336c|pink} and more', fontSize: 20, weight: 400, align: 'left' }),
        on('text', { id: 'right-bottom', kind: 'text', x: 320, y: 150, w: 300, h: 90, text: 'Right, bottom', fontSize: 26, align: 'right', valign: 'bottom', fg: '#1864ab' }),
        on('text', { id: 'bordered', kind: 'text', x: 20, y: 260, w: 200, h: 120, text: 'Inside a border', fontSize: 24, bg: '#fff3bf', stroke: '#e67700', strokeW: 6, shape: 'rounded', radius: 16 }),
        on('text', { id: 'overflow', kind: 'text', x: 240, y: 260, w: 170, h: 70, text: 'Too many words for this small rounded box to hold', fontSize: 20, shape: 'rounded', radius: 30, bg: '#e7f5ff' }),
        on('text', { id: 'spaced', kind: 'text', x: 430, y: 260, w: 190, h: 60, text: 'TRACKED', fontSize: 22, tracking: 6, lineHeight: 1.6 }),
        on('text', { id: 'on-box', kind: 'box', x: 430, y: 330, w: 190, h: 56, text: 'On a box', fontSize: 20, bg: '#2b8a3e', fg: '#ffffff', pad: 4 }),
      ],
    },
    {
      name: 'pictures', width: 640, height: 400,
      rows: [
        frame('pictures', { bg: '#ffffff' }),
        on('pictures', { id: 'contain', kind: 'image', x: 20, y: 20, w: 180, h: 120, image: 'fixture/wide', bg: '#e9ecef' }),
        on('pictures', { id: 'cover-corner', kind: 'image', x: 220, y: 20, w: 180, h: 120, image: 'fixture/wide', fit: 'cover', imgpos: 'left top' }),
        on('pictures', { id: 'fill', kind: 'image', x: 420, y: 20, w: 200, h: 120, image: 'fixture/wide', fit: 'fill' }),
        on('pictures', { id: 'none', kind: 'image', x: 20, y: 160, w: 180, h: 100, image: 'fixture/wide', fit: 'none', imgpos: 'right bottom', bg: '#fff5f5' }),
        on('pictures', { id: 'scale-down', kind: 'image', x: 220, y: 160, w: 180, h: 100, image: 'fixture/tall', fit: 'scale-down', bg: '#f8f0fc' }),
        on('pictures', { id: 'framed', kind: 'image', x: 420, y: 160, w: 200, h: 100, image: 'fixture/wide', fit: 'cover', imageFraming: { x: 30, y: 70, zoom: 150 } }),
        on('pictures', { id: 'rounded', kind: 'box', x: 20, y: 280, w: 180, h: 100, image: 'fixture/wide', fit: 'cover', shape: 'rounded', radius: 24, stroke: '#212529', strokeW: 6, text: 'Over a picture', fontSize: 18, fg: '#ffffff' }),
        on('pictures', { id: 'circle', kind: 'image', x: 220, y: 280, w: 100, h: 100, image: 'fixture/tall', fit: 'cover', shape: 'circle' }),
        on('pictures', { id: 'vector', kind: 'image', x: 340, y: 280, w: 140, h: 100, image: 'fixture/vector', bg: '#fff3bf' }),
        on('pictures', { id: 'on-path', kind: 'path', x: 500, y: 280, w: 120, h: 100, path: triangle, bg: '#ced4da', image: 'fixture/wide', fit: 'cover', imageFraming: { x: 50, y: 50, zoom: 120 } }),
      ],
    },
    {
      name: 'board', width: 640, height: 400,
      rows: [
        frame('board', { bg: '#dbe4ff', grad: 'lin.srgb_180_4dabf700-0_1864abff-100', stroke: '#364fc7', strokeW: 10, shape: 'rounded', radius: 48 }),
        on('board', { id: 'edge', kind: 'box', x: -30, y: 300, w: 200, h: 140, bg: '#f76707' }),
        on('board', { id: 'inside', kind: 'box', x: 240, y: 120, w: 160, h: 160, bg: '#ffffff', shape: 'rounded', radius: 20 }),
        // Zoomed out, the picture is clipped to its shrunken element inside the box.
        on('board', { id: 'zoomed-out', kind: 'image', x: 60, y: 40, w: 160, h: 100, image: 'fixture/wide', fit: 'cover', bg: '#fff9db', imageFraming: { x: 25, y: 50, zoom: 60 } }),
        // Contain leaves a fractional margin here (32.5 px each side), which the renderer snaps.
        on('board', { id: 'snapped', kind: 'image', x: 440, y: 140, w: 100, h: 70, image: 'fixture/tall' }),
      ],
    },
    {
      name: 'board-picture', width: 640, height: 400,
      rows: [
        frame('board-picture', { bg: '#212529', image: 'fixture/wide', fit: 'contain', imgpos: 'center top', stroke: '#fab005', strokeW: 8, shape: 'rounded', radius: 32 }),
        on('board-picture', { id: 'corner', kind: 'box', x: 560, y: 330, w: 120, h: 120, bg: '#e64980' }),
      ],
    },
  ];
}

export interface RegionStats {
  id: string; pixels: number; differing: number;
  /** For a region that asks for ink: what each side adds to the background (summed luminance change) and the centroid of that ink. */
  ink?: { a: number; b: number; ax: number; ay: number; bx: number; by: number };
}
export interface FidelityStats { width: number; height: number; differing: number; maxChannel: number; regions: RegionStats[] }

/**
 * Runs in the browser: decode two PNG screenshots, count pixels whose largest channel
 * difference exceeds `threshold`, for the whole page and inside each region. A region
 * that asks for ink is also compared with `background`, the page without the words it judges.
 */
export async function compareInBrowser(a: string, b: string, width: number, height: number, regions: Array<{ id: string; x: number; y: number; w: number; h: number; ink?: boolean }>, threshold: number, background?: string): Promise<FidelityStats> {
  const pixels = async (src: string) => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const [pa, pb, pg] = await Promise.all([pixels(a), pixels(b), background ? pixels(background) : Promise.resolve(undefined)]);
  const lum = (p: Uint8ClampedArray, i: number) => 0.2126 * p[i * 4]! + 0.7152 * p[i * 4 + 1]! + 0.0722 * p[i * 4 + 2]!;
  const diff = new Uint8Array(width * height);
  let differing = 0, maxChannel = 0;
  for (let i = 0; i < width * height; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(pa[i * 4 + c]! - pb[i * 4 + c]!));
    maxChannel = Math.max(maxChannel, m);
    if (m > threshold) { diff[i] = 1; differing++; }
  }
  return {
    width, height, differing, maxChannel,
    regions: regions.map((r) => {
      const ink = r.ink && pg ? pg : undefined;
      let n = 0, d = 0, ia = 0, ib = 0, ax = 0, ay = 0, bx = 0, by = 0;
      for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(height, Math.ceil(r.y + r.h)); y++) {
        for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(width, Math.ceil(r.x + r.w)); x++) {
          const i = y * width + x;
          n++; d += diff[i]!;
          if (ink) {
            const g = lum(ink, i), wa = Math.abs(lum(pa, i) - g), wb = Math.abs(lum(pb, i) - g);
            ia += wa; ib += wb; ax += wa * x; ay += wa * y; bx += wb * x; by += wb * y;
          }
        }
      }
      return { id: r.id, pixels: n, differing: d, ...(ink ? { ink: { a: ia, b: ib, ax: ia ? ax / ia : 0, ay: ia ? ay / ia : 0, bx: ib ? bx / ib : 0, by: ib ? by / ib : 0 } } : {}) };
    }),
  };
}
