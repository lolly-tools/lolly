// SPDX-License-Identifier: MPL-2.0
/** Asset reference syntax, without icon rendering or photo processing dependencies. */
export interface ParsedThemedAssetId { baseId: string; theme: string | null }
export interface ParsedTreatedAssetId { baseId: string; treatment: string | null }
const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TREATMENT_ID_RE = THEME_ID_RE;
const THEME_SUFFIX = '?theme=';
const TREATMENT_SUFFIX = '?treatment=';
const FILE_ID_RE = /^[a-f0-9]{24}$/;
export function parseFileAssetId(id: string): { baseId: string; file: string | null } {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, file: null };
  const match = /^([^?]+)\?file=([a-f0-9]{24})$/.exec(id);
  return match ? { baseId: match[1]!, file: match[2]! } : { baseId: id, file: null };
}
export function buildFileAssetId(baseId: string, file: string): string {
  if (!baseId || baseId.includes('?') || baseId.includes('://') || !FILE_ID_RE.test(file)) throw new Error('Invalid asset file identity');
  return `${baseId}?file=${file}`;
}

function styledFile(id: string, style: 'theme' | 'treatment'): { baseId: string; value: string } | null {
  if (id.includes('://')) return null;
  const match = new RegExp(`^([^?]+\\?file=[a-f0-9]{24})&${style}=([a-z0-9][a-z0-9-]*)$`).exec(id);
  return match ? { baseId: match[1]!, value: match[2]! } : null;
}
export function parseThemedAssetId(id: string): ParsedThemedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, theme: null };
  const file = styledFile(id, 'theme'); if (file) return { baseId: file.baseId, theme: file.value };
  const i = id.indexOf(THEME_SUFFIX);
  if (i <= 0) return { baseId: id, theme: null };
  const baseId = id.slice(0, i);
  const theme = id.slice(i + THEME_SUFFIX.length);
  if (baseId.includes('?') || !THEME_ID_RE.test(theme)) return { baseId: id, theme: null };
  return { baseId, theme };
}

export function parseTreatedAssetId(id: string): ParsedTreatedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, treatment: null };
  const file = styledFile(id, 'treatment'); if (file) return { baseId: file.baseId, treatment: file.value };
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
