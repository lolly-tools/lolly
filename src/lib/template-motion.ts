// SPDX-License-Identifier: MPL-2.0
/** Small metadata carried by the catalog; every animation remains in `values`. */
export interface TemplateMotion {
  collection: string;
  recipe: string;
  durationMs: number;
  posterMs: number;
  beats: string[];
}

export function parseTemplateMotion(value: unknown): TemplateMotion | undefined {
  if (!value || typeof value !== 'object') return;
  const m = value as Record<string, unknown>;
  if (typeof m.collection !== 'string' || !m.collection || typeof m.recipe !== 'string' || !m.recipe
    || typeof m.durationMs !== 'number' || !Number.isFinite(m.durationMs) || m.durationMs < 800 || m.durationMs > 30000
    || typeof m.posterMs !== 'number' || !Number.isFinite(m.posterMs) || m.posterMs < 0 || m.posterMs >= m.durationMs
    || !Array.isArray(m.beats) || !m.beats.length || m.beats.length > 8 || m.beats.some(b => typeof b !== 'string' || b.length > 160)) return;
  return { collection: m.collection, recipe: m.recipe, durationMs: m.durationMs, posterMs: m.posterMs, beats: m.beats as string[] };
}
