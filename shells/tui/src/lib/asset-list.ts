// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for browsing catalog assets in the terminal - shared by the Catalog
 * view and the ToolView asset-input picker so both render/filter identically. No React,
 * no fs: takes an already-loaded AssetRow[] (see catalog.loadAssets).
 *
 * Emoji are the SAME safe single-codepoint U+1F3xx–1F5xx set the gallery uses (see
 * emoji.ts) so terminal width == string-width and fixed-width rows don't drift.
 */
import type { AssetRow } from '../catalog.ts';

// Asset types that resolve to a picture - the only ones offered as an `asset` INPUT
// (a logo/photo slot). tokens/palette/audio are catalog assets but not image inputs.
export const VISUAL_TYPES = new Set(['vector', 'raster', 'lottie']);

/** Type → safe emoji (single codepoint, U+1F3xx–1F5xx; see emoji.ts alignment notes). */
export function assetEmoji(type?: string): string {
  switch (type) {
    case 'vector': return '📐';
    case 'raster': return '📷';
    case 'lottie': return '🎬';
    case 'audio': return '🔊';
    case 'palette': return '🎨';
    case 'tokens': return '📦';
    default: return '📎';
  }
}

/** First declared format string, e.g. "svg" / "png" / "json". */
export function assetFormat(a: AssetRow): string {
  return a.formats?.[0]?.format ?? '-';
}

/** Human byte size of the first format (e.g. "4.2 KB"). */
export function assetSize(a: AssetRow): string {
  const n = a.formats?.[0]?.size;
  if (!n || n <= 0) return '';
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Case-insensitive filter over id + name + tags + type. Empty query → all. */
export function filterAssets(assets: AssetRow[], query: string, visualOnly = false): AssetRow[] {
  const base = visualOnly ? assets.filter(a => VISUAL_TYPES.has(a.type ?? '')) : assets;
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(a =>
    `${a.id} ${a.name} ${a.type ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase().includes(q));
}

/** One-line detail string for the selected asset (type · format · size · tags). */
export function assetDetail(a: AssetRow): string {
  const bits = [a.type ?? 'asset', assetFormat(a)];
  const sz = assetSize(a); if (sz) bits.push(sz);
  const tags = (a.tags ?? []).filter(t => t !== 'official').slice(0, 4);
  const tail = tags.length ? `  ·  ${tags.join(', ')}` : '';
  return bits.join(' · ') + tail;
}
