// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { coerceCell } from './io.ts';
import { UNITS, isTokenValue } from '@lolly/engine';
import { flattenValue, type InputValue } from '../../../../engine/src/inputs.ts';
import { writeStoredInput } from '../lib/token-bulk-link.ts';

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
  // A token-linked cell copies the value it shows, not the link record.
  if (isTokenValue(value)) return String(flattenValue(value));
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
  // Scalar writes follow the engine's restore rule: a value pasted over a token link records the link.
  if (raw === '') {
    if (input.type === 'blocks') row.values[key] = [];
    else if (input.type === 'boolean') row.values[key] = false;
    else if (['text', 'longtext', 'url', 'date', 'time', 'datetime-local'].includes(input.type)) writeStoredInput(row.values, key, '');
    else writeStoredInput(row.values, key, undefined);
    return true;
  }
  if (input.type === 'vector' || input.type === 'table') {
    try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== 'object') return false; row.values[key] = value; return true; }
    catch { return false; }
  }
  const value = coerceCell(input, raw);
  if (value === undefined) return false;
  writeStoredInput(row.values, key, value); return true;
}

/**
 * Write a value from a cell control, a colour pick or a Fill into one row. Scalar
 * writes follow the engine's restore rule: a value over a token link records that
 * link, so a later bulk link keeps it as an override; a link clears the record.
 */
export function writeControlValue(row: Pick<CellRow, 'values'>, key: string, value: InputValue | undefined): void {
  writeStoredInput(row.values, key, value);
}

/**
 * Write one pasted row whose cells are mapped to input ids (a header or column
 * mapping, not position). Each cell is coerced by this row's own declaration, and
 * cells it cannot take are skipped. Returns how many values were written.
 */
export function writeMappedRow(row: CellRow, cells: readonly string[], ids: readonly (string | null)[]): number {
  const byId = new Map((row.manifest?.inputs ?? []).map(input => [input.id, input]));
  let filled = 0;
  cells.forEach((raw, c) => {
    const id = ids[c];
    const input = id ? byId.get(id) : undefined;
    if (!input) return;
    const value = coerceCell(input, raw);
    if (value !== undefined) { writeControlValue(row, id!, value); filled++; }
  });
  return filled;
}
