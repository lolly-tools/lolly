// SPDX-License-Identifier: MPL-2.0
/** Bounded colour components locate accent strips beside rounded neutral panels. */
import type { ForensicShape } from './types.ts';
export function forensicRasterCards(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): ForensicShape[] {
  const count = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    count > 4_000_000 ||
    rgba.length !== count * 4
  )
    throw new Error('Forensic raster pixel budget exceeded.');
  const visited = new Uint8Array(count),
    queue = new Int32Array(count),
    shapes: ForensicShape[] = [];
  const colour = (p: number): number[] => [rgba[p * 4]!, rgba[p * 4 + 1]!, rgba[p * 4 + 2]!];
  const saturated = (p: number): boolean => {
    const c = colour(p),
      hi = Math.max(...c),
      lo = Math.min(...c);
    return rgba[p * 4 + 3]! >= 240 && hi > 75 && hi - lo > 70 && (hi - lo) / hi > 0.35;
  };
  const component = (
    start: number,
    accepts: (p: number) => boolean,
    marks: Uint8Array
  ): { left: number; top: number; right: number; bottom: number; area: number } => {
    let head = 0,
      tail = 1,
      left = width,
      top = height,
      right = 0,
      bottom = 0;
    queue[0] = start;
    marks[start] = 1;
    while (head < tail) {
      const p = queue[head++]!,
        x = p % width,
        y = Math.floor(p / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const q of [
        x > 0 ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y + 1 < height ? p + width : -1,
      ]) {
        if (q >= 0 && !marks[q] && accepts(q)) {
          marks[q] = 1;
          queue[tail++] = q;
        }
      }
    }
    return { left, top, right, bottom, area: tail };
  };
  const bodyMarks = new Uint8Array(count);
  let candidates = 0;
  for (let p = 0; p < count && candidates < 256; p++) {
    if (visited[p] || !saturated(p)) continue;
    const strip = component(p, saturated, visited),
      sw = strip.right - strip.left + 1,
      sh = strip.bottom - strip.top + 1;
    if (
      strip.area < 80 ||
      strip.area / (sw * sh) < 0.16 ||
      Math.max(sw, sh) < 60 ||
      Math.min(sw, sh) / Math.max(sw, sh) > 0.25
    )
      continue;
    candidates++;
    const vertical = sh > sw;
    const seeds = vertical
      ? [
          [strip.right + 3, Math.round((strip.top + strip.bottom) / 2)],
          [strip.left - 3, Math.round((strip.top + strip.bottom) / 2)],
        ]
      : [
          [Math.round((strip.left + strip.right) / 2), strip.bottom + 3],
          [Math.round((strip.left + strip.right) / 2), strip.top - 3],
        ];
    for (const [sx, sy] of seeds as [number, number][]) {
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const start = sy * width + sx,
        base = colour(start);
      if (
        Math.max(...base) - Math.min(...base) > 40 ||
        Math.min(...base) >= 248 ||
        bodyMarks[start]
      )
        continue;
      const accepts = (q: number): boolean =>
        rgba[q * 4 + 3]! >= 240 && colour(q).every((c, i) => Math.abs(c - base[i]!) <= 8);
      const body = component(start, accepts, bodyMarks),
        bw = body.right - body.left + 1,
        bh = body.bottom - body.top + 1;
      if (
        body.area > count * 0.55 ||
        bw < 70 ||
        bh < 50 ||
        (vertical
          ? bw < sw * 3 || Math.abs(bh - sh) > sh * 0.25
          : bh < sh * 3 || Math.abs(bw - sw) > sw * 0.25)
      )
        continue;
      const corners = [
        [body.left + 2, body.top + 2],
        [body.right - 2, body.top + 2],
        [body.left + 2, body.bottom - 2],
        [body.right - 2, body.bottom - 2],
      ];
      if (corners.filter(([x, y]) => !accepts(y! * width + x!)).length < 2) continue;
      const edge = vertical
        ? sx > strip.right
          ? 'left'
          : 'right'
        : sy > strip.bottom
          ? 'top'
          : 'bottom';
      const box = {
        x: Math.min(body.left, strip.left),
        y: Math.min(body.top, strip.top),
        width: Math.max(body.right, strip.right) - Math.min(body.left, strip.left) + 1,
        height: Math.max(body.bottom, strip.bottom) - Math.min(body.top, strip.top) + 1,
      };
      const hex = (c: number[]) => `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      shapes.push({
        box,
        radius: Math.min(bw, bh) * 0.1,
        fill: hex(base),
        accent: {
          edge,
          width: Math.max(1, strip.area / (vertical ? sh : sw)),
          colour: hex(colour(p)),
        },
      });
      break;
    }
  }
  return shapes.slice(0, 64);
}
