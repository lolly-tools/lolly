// SPDX-License-Identifier: MPL-2.0
/** Asset reference syntax, without icon rendering or photo processing dependencies. */
export interface ParsedThemedAssetId { baseId: string; theme: string | null }
export interface ParsedTreatedAssetId { baseId: string; treatment: string | null }
const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TREATMENT_ID_RE = THEME_ID_RE;
const THEME_SUFFIX = '?theme=';
const TREATMENT_SUFFIX = '?treatment=';
export function parseThemedAssetId(id: string): ParsedThemedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, theme: null };
  const i = id.indexOf(THEME_SUFFIX);
  if (i <= 0) return { baseId: id, theme: null };
  const baseId = id.slice(0, i);
  const theme = id.slice(i + THEME_SUFFIX.length);
  if (baseId.includes('?') || !THEME_ID_RE.test(theme)) return { baseId: id, theme: null };
  return { baseId, theme };
}

export function parseTreatedAssetId(id: string): ParsedTreatedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, treatment: null };
  const i = id.indexOf(TREATMENT_SUFFIX);
  if (i <= 0) return { baseId: id, treatment: null };
  const baseId = id.slice(0, i);
  const treatment = id.slice(i + TREATMENT_SUFFIX.length);
  if (baseId.includes('?') || !TREATMENT_ID_RE.test(treatment)) return { baseId: id, treatment: null };
  return { baseId, treatment };
}

export function stripAssetModifiers(id: string): string {
  if (typeof id !== 'string' || id.includes('://')) return id;
  const i = id.indexOf('?');
  return i > 0 ? id.slice(0, i) : id;
}
