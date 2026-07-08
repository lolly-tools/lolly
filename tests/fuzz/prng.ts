// SPDX-License-Identifier: MPL-2.0
/**
 * Seeded, deterministic PRNG for the engine fuzz harness.
 *
 * mulberry32 — a tiny 32-bit generator. No Date.now / Math.random anywhere, so
 * every run with the same seed produces byte-identical mutation sequences. That
 * determinism is the whole point: a failing iteration is reproducible forever
 * (the regression test replays the exact seeds), and CI never flakes.
 */

export interface Rng {
  /** next float in [0, 1). */
  next(): number;
  /** next integer in [0, n). */
  int(n: number): number;
  /** next byte 0..255. */
  byte(): number;
  /** true with probability p. */
  chance(p: number): boolean;
  /** pick one element. */
  pick<T>(arr: readonly T[]): T;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number): number => Math.floor(next() * n),
    byte: (): number => Math.floor(next() * 256) & 0xff,
    chance: (p: number): boolean => next() < p,
    pick<T>(arr: readonly T[]): T { return arr[Math.floor(next() * arr.length)]!; },
  };
}
