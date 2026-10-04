// SPDX-License-Identifier: MPL-2.0
/**
 * Deterministic pictures and spots for the healing tests (plans/289 D4), shared by
 * scripts/build-heal-goldens.ts, which runs them through Compositor's C, and
 * tests/heal.test.ts, which runs them through engine/src/heal.ts. Integer maths
 * only, so both sides build the same bytes.
 */

export interface HealCase {
  name: string;
  width: number;
  height: number;
  /** Premultiplied RGBA. */
  rgba: Uint8Array;
  coverage: Uint8Array;
  mode: 0 | 1 | 2;
  seed: number;
  opacity: number;
}

const hash = (x: number): number => {
  x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

type Painter = (x: number, y: number) => [number, number, number, number];

const PICTURES: Record<string, Painter> = {
  // Diagonal stripes on a gentle gradient: repeating texture a patch can match.
  stripes: (x, y) => {
    const on = ((x + y) % 9) < 4;
    return [on ? 200 - y : 60 + x, on ? 120 : 90 + (y >> 1), on ? 40 + x : 180, 255];
  },
  // A smooth gradient with per-pixel grain: texture a smooth fill has to imitate.
  grain: (x, y) => {
    const n = (hash(y * 977 + x) & 31) - 16;
    return [110 + x + n, 140 - (y >> 1) + n, 90 + ((x + y) >> 1) + n, 255];
  },
  // Dark above a light band, the edge through the spot: the membrane has to bend.
  edge: (x, y) => (y < 30 + (x >> 3) ? [30, 40, 60, 255] : [230, 220, 200, 255]),
  // Opaque on the left, half transparent on the right: alpha must heal too.
  alpha: (x, y) => {
    const a = x < 36 ? 255 : 128;
    const r = 180, g = 60 + (y & 15) * 4, b = 90;
    return [Math.round((r * a) / 255), Math.round((g * a) / 255), Math.round((b * a) / 255), a];
  },
};

function picture(name: string, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const paint = PICTURES[name]!;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = paint(x, y).map((v) => Math.max(0, Math.min(255, v)));
      out.set(px, (y * width + x) * 4);
    }
  }
  return out;
}

/** A disc of radius r at (cx, cy); `soft` feathers the last two pixels of its edge. */
function disc(width: number, height: number, cx: number, cy: number, r: number, soft = false): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r * r) out[y * width + x] = 255;
      else if (soft && d2 <= (r + 2) * (r + 2)) out[y * width + x] = 128;
    }
  }
  return out;
}

export function healCases(): HealCase[] {
  const W = 72, H = 72;
  const cases: HealCase[] = [];
  const modes: Array<0 | 1 | 2> = [0, 1, 2];
  for (const name of ['stripes', 'grain', 'edge']) {
    for (const mode of modes) {
      cases.push({ name: `${name}-m${mode}`, width: W, height: H, rgba: picture(name, W, H), coverage: disc(W, H, 38, 34, 7), mode, seed: 7, opacity: 1 });
    }
  }
  cases.push({ name: 'alpha-m0', width: W, height: H, rgba: picture('alpha', W, H), coverage: disc(W, H, 36, 36, 6), mode: 0, seed: 7, opacity: 1 });
  cases.push({ name: 'grain-m1-soft-60', width: W, height: H, rgba: picture('grain', W, H), coverage: disc(W, H, 30, 40, 9, true), mode: 1, seed: 1234, opacity: 0.6 });
  // A large spot, so the solver starts from a coarser copy of itself.
  cases.push({ name: 'stripes-m0-large', width: 192, height: 160, rgba: picture('stripes', 192, 160), coverage: disc(192, 160, 70, 60, 20), mode: 0, seed: 7, opacity: 1 });
  return cases;
}
