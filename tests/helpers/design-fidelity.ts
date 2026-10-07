// SPDX-License-Identifier: MPL-2.0
/**
 * Fidelity fixtures for the drawing compiler (plan 295, phase 3): static Design pages
 * rendered by the real Design tool and by the compiled SVG, compared region by region.
 */
import { encodeAuthoredPaths } from '../../engine/src/geom/authored-url.ts';

type Row = Record<string, unknown>;
const path = (closed: boolean, nodes: Array<Record<string, number>>) => encodeAuthoredPaths([{ kind: 'cubic', closed, nodes }] as never) ?? '';
const triangle = path(true, [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }]);
const wave = path(false, [{ x: 0, y: 0.5, hOutX: 0.2, hOutY: -0.5 }, { x: 0.5, y: 0.5, hInX: -0.2, hInY: 0.5, hOutX: 0.2, hOutY: -0.5 }, { x: 1, y: 0.5, hInX: -0.2, hInY: 0.5 }]);
const ring = encodeAuthoredPaths([
  { kind: 'cubic', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  { kind: 'cubic', closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }] },
] as never) ?? '';

export interface FidelityPage { name: string; width: number; height: number; rows: Row[] }

/** Pages without text or pictures: the slice that geometry, paint and effects decide. */
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
  ];
}

export interface RegionStats { id: string; pixels: number; differing: number }
export interface FidelityStats { width: number; height: number; differing: number; maxChannel: number; regions: RegionStats[] }

/**
 * Runs in the browser: decode two PNG screenshots, count pixels whose largest channel
 * difference exceeds `threshold`, for the whole page and inside each region.
 */
export async function compareInBrowser(a: string, b: string, width: number, height: number, regions: Array<{ id: string; x: number; y: number; w: number; h: number }>, threshold: number): Promise<FidelityStats> {
  const pixels = async (src: string) => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
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
      let n = 0, d = 0;
      for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(height, Math.ceil(r.y + r.h)); y++) {
        for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(width, Math.ceil(r.x + r.w)); x++) { n++; d += diff[y * width + x]!; }
      }
      return { id: r.id, pixels: n, differing: d };
    }),
  };
}
