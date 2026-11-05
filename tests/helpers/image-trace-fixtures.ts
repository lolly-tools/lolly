// SPDX-License-Identifier: MPL-2.0
/** Small code-drawn inputs for Trace image: no files, the same pixels on every machine. */

export interface Fixture { name: string; preset: 'logo' | 'illustration' | 'line-art' | 'centreline'; width: number; height: number; rgba: Uint8Array }

type Rgb = [number, number, number];
const SS = 4;

/** Fill an image from a coverage function per colour layer, anti-aliased by 4 by 4 supersampling. */
function draw(width: number, height: number, bg: Rgb, layers: { color: Rgb; inside: (x: number, y: number) => boolean }[]): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const acc = [0, 0, 0];
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const px = x + (i + 0.5) / SS, py = y + (j + 0.5) / SS;
      let c = bg;
      for (const l of layers) if (l.inside(px, py)) c = l.color;
      acc[0]! += c[0]; acc[1]! += c[1]; acc[2]! += c[2];
    }
    const o = (y * width + x) * 4;
    out[o] = Math.round(acc[0]! / (SS * SS)); out[o + 1] = Math.round(acc[1]! / (SS * SS)); out[o + 2] = Math.round(acc[2]! / (SS * SS)); out[o + 3] = 255;
  }
  return out;
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
const ring = (cx: number, cy: number, r: number, w: number) => (x: number, y: number) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= w / 2;
const seg = (ax: number, ay: number, bx: number, by: number, w: number) => (x: number, y: number) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= w / 2;
};

export function logoFixture(size = 160): Fixture {
  const k = size / 160;
  return {
    name: 'flat logo', preset: 'logo', width: size, height: size,
    rgba: draw(size, size, [255, 255, 255], [
      { color: [30, 90, 200], inside: disc(80 * k, 80 * k, 62 * k) },
      { color: [240, 200, 40], inside: rect(50 * k, 62 * k, 110 * k, 98 * k) },
      { color: [220, 40, 60], inside: disc(80 * k, 80 * k, 16 * k) },
    ]),
  };
}
export function illustrationFixture(width = 240, height = 160): Fixture {
  const k = width / 240;
  return {
    name: 'flat illustration', preset: 'illustration', width, height,
    rgba: draw(width, height, [190, 225, 250], [
      { color: [250, 210, 60], inside: disc(190 * k, 36 * k, 20 * k) },
      { color: [70, 160, 90], inside: (x, y) => y > (110 + 14 * Math.sin(x / (22 * k))) * k },
      { color: [120, 80, 50], inside: rect(60 * k, 90 * k, 70 * k, 125 * k) },
      { color: [40, 120, 60], inside: disc(65 * k, 80 * k, 22 * k) },
    ]),
  };
}
export function lineArtFixture(size = 160): Fixture {
  const k = size / 160;
  return {
    name: 'line art', preset: 'line-art', width: size, height: size,
    rgba: draw(size, size, [250, 250, 250], [
      { color: [15, 15, 15], inside: ring(80 * k, 80 * k, 55 * k, 5 * k) },
      { color: [15, 15, 15], inside: seg(30 * k, 30 * k, 130 * k, 130 * k, 4 * k) },
      { color: [15, 15, 15], inside: seg(30 * k, 130 * k, 130 * k, 30 * k, 3 * k) },
    ]),
  };
}
export function centrelineFixture(size = 160): Fixture {
  return { ...lineArtFixture(size), name: 'centre lines', preset: 'centreline' };
}

/** A photo-like picture: shaded soft discs, a gradient and fixed-seed noise. For timing and the pixel cap. */
export function photoFixture(width: number, height: number): Fixture {
  const rgba = new Uint8Array(width * height * 4);
  let s = 0x9e3779b9;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const discs = Array.from({ length: 40 }, () => ({ x: rnd() * width, y: rnd() * height, r: (0.03 + rnd() * 0.1) * Math.min(width, height), c: [rnd() * 255, rnd() * 255, rnd() * 255] }));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = [80 + 120 * (x / width), 90 + 100 * (y / height), 160];
    for (const d of discs) {
      const e = Math.hypot(x - d.x, y - d.y) / d.r;
      if (e < 1) { const a = Math.min(1, (1 - e) * 4); for (let i = 0; i < 3; i++) c[i] = c[i]! * (1 - a) + d.c[i]! * a * (0.6 + 0.4 * (1 - e)); }
    }
    const o = (y * width + x) * 4;
    for (let i = 0; i < 3; i++) rgba[o + i] = Math.max(0, Math.min(255, Math.round(c[i]! + (rnd() - 0.5) * 12)));
    rgba[o + 3] = 255;
  }
  return { name: `photo ${width}x${height}`, preset: 'illustration', width, height, rgba };
}

export const SMALL_FIXTURES = (): Fixture[] => [logoFixture(), illustrationFixture(), lineArtFixture(), centrelineFixture()];
