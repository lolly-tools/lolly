// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { coerceCell } from './io.ts';
import { UNITS } from '@lolly/engine';

interface CellRow {
  toolId: string; manifest: ToolManifest | null; values: Record<string, unknown>;
  filename?: string; outWidth?: number; outHeight?: number; unit?: string; dpi?: number;
}

export function readCell(row: CellRow, key: string, defaults: { unit: string; dpi: number }): string {
  if (key === '__template') return row.toolId;
  if (key === '__filename') return row.filename ?? '';
  if (key === '__width') return row.outWidth == null ? '' : String(row.outWidth);
  if (key === '__height') return row.outHeight == null ? '' : String(row.outHeight);
  if (key === '__unit') return row.unit ?? defaults.unit;
  if (key === '__dpi') return String(row.dpi ?? defaults.dpi);
  const input = row.manifest?.inputs.find(input => input.id === key);
  if (!input) return '';
  const value = row.values[key] ?? input.default;
  if (value == null) return '';
  if (input.type === 'asset') return typeof value === 'string' ? value : String((value as { id?: string }).id ?? '');
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Only the destination declaration decides how a pasted cell becomes a value. */
export function writeCell(row: CellRow, key: string, raw: string): boolean {
  if (key === '__template') return false;
  if (key === '__filename') { row.filename = raw; return true; }
  if (key === '__unit') {
    const unit = raw.trim().toLowerCase();
    if (unit && !(UNITS as readonly string[]).includes(unit)) return false;
    row.unit = unit || undefined; return true;
  }
  const numeric = { __width: 'outWidth', __height: 'outHeight', __dpi: 'dpi' } as const;
  if (Object.hasOwn(numeric, key)) {
    const n = Number(raw);
    if (raw.trim() && (!Number.isFinite(n) || n <= 0)) return false;
    row[numeric[key as keyof typeof numeric]] = raw.trim() ? n : undefined; return true;
  }
  const input = row.manifest?.inputs.find(input => input.id === key);
  if (!input) return false;
  if (raw === '') {
    if (input.type === 'blocks') row.values[key] = [];
    else if (input.type === 'boolean') row.values[key] = false;
    else if (['text', 'longtext', 'url', 'date', 'time', 'datetime-local'].includes(input.type)) row.values[key] = '';
    else delete row.values[key];
    return true;
  }
  if (input.type === 'vector' || input.type === 'table') {
    try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== 'object') return false; row.values[key] = value; return true; }
    catch { return false; }
  }
  const value = coerceCell(input, raw);
  if (value === undefined) return false;
  row.values[key] = value; return true;
}
