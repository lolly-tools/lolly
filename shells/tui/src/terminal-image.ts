// SPDX-License-Identifier: MPL-2.0
/**
 * Optional inline preview. We rasterise the tool's SVG with resvg (pure Rust, no
 * browser) and return a grid of HALF-BLOCK cells - each cell is a character plus a
 * foreground/background hex colour that INK applies via its own <Text> props. We do
 * NOT emit raw ANSI escape codes ourselves: Ink owns the screen and mangles injected
 * SGR sequences (that produced the `▀;0;0m` garbage). Letting Ink colour the cells is
 * the reliable path. Preview is opt-in (press `p`) since it's secondary to the form.
 */
import { Resvg } from '@resvg/resvg-js';

/** One rendered cell: a glyph Ink colours. `fg`/`bg` omitted → terminal default. */
export interface Cell { ch: string; fg?: string; bg?: string }

interface Rendered { pixels: Buffer; width: number; height: number }

const hex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

/** Rasterise an SVG to fit inside boxW×boxH pixels, preserving aspect ratio. */
function renderFit(svg: string, boxW: number, boxH: number): Rendered {
  const bg = 'rgba(255,255,255,0)';
  let img = new Resvg(svg, { fitTo: { mode: 'width', value: Math.max(2, boxW) }, background: bg }).render();
  if (img.height > boxH) {
    img = new Resvg(svg, { fitTo: { mode: 'height', value: Math.max(2, boxH) }, background: bg }).render();
  }
  return { pixels: img.pixels, width: img.width, height: img.height };
}

/**
 * Render an SVG string to a grid of cells sized to fit `cols`×`rows` character cells
 * (pixel budget cols×rows*2, two vertical pixels per cell). Returns [] on failure.
 */
export function svgToCells(svg: string, cols: number, rows: number): Cell[][] {
  let img: Rendered;
  try { img = renderFit(svg, cols, rows * 2); } catch { return []; }
  const { pixels: p, width: W, height: H } = img;
  const at = (x: number, y: number): [number, number, number, number] => {
    const i = (y * W + x) * 4;
    return [p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0, p[i + 3] ?? 0];
  };
  const grid: Cell[][] = [];
  for (let y = 0; y < H; y += 2) {
    const row: Cell[] = [];
    for (let x = 0; x < W; x++) {
      const [tr, tg, tb, ta] = at(x, y);
      const [br, bg, bb, ba] = y + 1 < H ? at(x, y + 1) : [0, 0, 0, 0];
      const top = ta > 20, bot = ba > 20;
      if (!top && !bot) row.push({ ch: ' ' });
      else if (top && bot) row.push({ ch: '▀', fg: hex(tr, tg, tb), bg: hex(br, bg, bb) });
      else if (top) row.push({ ch: '▀', fg: hex(tr, tg, tb) });
      else row.push({ ch: '▄', fg: hex(br, bg, bb) });
    }
    grid.push(row);
  }
  return grid;
}
