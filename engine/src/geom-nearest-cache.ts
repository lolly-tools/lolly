// SPDX-License-Identifier: MPL-2.0
/** Bounded private parsed paths for repeated nearest-point queries. */
import type { GeomFailure } from './bridge/host-v1.ts';
import type { GeomPath } from './geom/path.ts';

export const NEAREST_CACHE_LIMITS = Object.freeze({
  maxEntries: 8,
  maxCharacters: 1_024_000,
  maxCurves: 32_000,
});

/** Successful immutable strings identify private parsed values; failures never enter the cache. */
export function createNearestPathCache(parse: (d: unknown) => GeomPath | GeomFailure) {
  const entries = new Map<string, { path: GeomPath; curves: number }>();
  let characters = 0,
    curves = 0;

  function load(d: unknown): GeomPath | GeomFailure {
    const cached = typeof d === 'string' ? entries.get(d) : undefined;
    if (cached && typeof d === 'string') {
      entries.delete(d);
      entries.set(d, cached);
      return cached.path;
    }
    const path = parse(d);
    if (!Array.isArray(path) || typeof d !== 'string') return path;
    const count = path.reduce((total, contour) => total + contour.curves.length, 0);
    if (d.length > NEAREST_CACHE_LIMITS.maxCharacters || count > NEAREST_CACHE_LIMITS.maxCurves)
      return path;
    while (
      entries.size >= NEAREST_CACHE_LIMITS.maxEntries ||
      characters + d.length > NEAREST_CACHE_LIMITS.maxCharacters ||
      curves + count > NEAREST_CACHE_LIMITS.maxCurves
    ) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      const previous = entries.get(oldest)!;
      entries.delete(oldest);
      characters -= oldest.length;
      curves -= previous.curves;
    }
    entries.set(d, { path, curves: count });
    characters += d.length;
    curves += count;
    return path;
  }
  function clear(): void {
    entries.clear();
    characters = 0;
    curves = 0;
  }
  return { load, clear, stats: () => ({ entries: entries.size, characters, curves }) };
}
