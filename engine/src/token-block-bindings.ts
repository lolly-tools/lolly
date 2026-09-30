// SPDX-License-Identifier: MPL-2.0
/** Portable links on scalar block properties, with explicit local overrides. */
import type { BlockFieldSpec, InputValue } from './inputs.ts';
import type { TokenSet } from './bridge/host-v1.ts';
import { aliasPath, isAlias, isTokenValue } from './tokens.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { canonicalJson } from './canonical-json.ts';

export interface BlockTokenBinding {
  ref: string;
  value: string | number;
  custom?: boolean;
  status?: 'linked' | 'unresolved' | 'incompatible';
  reason?: string;
}
type Row = { [key: string]: InputValue | undefined };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const scalar = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value);
const sameScalar = (value: unknown, cached: string | number): boolean => value === cached
  || typeof cached === 'number' && typeof value === 'string' && value.trim() !== '' && Number(value) === cached;
const safeField = (field: string): boolean => field.length > 0 && field.length <= 256 && !['__proto__', 'constructor', 'prototype'].includes(field);
function encodeBindings(links: Record<string, BlockTokenBinding>): string {
  const encoded = canonicalJson(links);
  if (Object.keys(links).length > 64 || encoded.length > 32768) throw new Error('This layer has too much token-link data.');
  return encoded;
}

/** The metadata occupies one appended text field in the compact block wire format. */
export function readBlockTokenBindings(raw: unknown): Record<string, BlockTokenBinding> {
  if (typeof raw !== 'string' || !raw || raw.length > 32768) return {};
  let source: unknown;
  try { source = JSON.parse(raw); } catch { return {}; }
  if (!record(source) || Object.keys(source).length > 64) return {};
  const result: Record<string, BlockTokenBinding> = {};
  for (const [field, value] of Object.entries(source)) {
    if (!safeField(field) || !record(value) || !isAlias(value.ref) || value.ref.length > 1024 || !scalar(value.value)) continue;
    result[field] = { ref: value.ref, value: value.value, ...(value.custom === true ? { custom: true } : {}), ...(['linked', 'unresolved', 'incompatible'].includes(String(value.status)) ? { status: value.status as BlockTokenBinding['status'] } : {}), ...(typeof value.reason === 'string' ? { reason: value.reason.slice(0, 1000) } : {}) };
  }
  return result;
}

/** Changing a scalar keeps the old link available without letting it overwrite the edit. */
export function reconcileBlockTokenBindings(rows: InputValue[], metadataField: string): InputValue[] {
  return rows.map(row => {
    if (!record(row)) return row;
    const links = readBlockTokenBindings(row[metadataField]);
    let changed = false;
    for (const [field, link] of Object.entries(links)) if (!link.custom && !sameScalar(row[field], link.value)) {
      links[field] = { ref: link.ref, value: link.value, custom: true }; changed = true;
    }
    return changed ? { ...row, [metadataField]: encodeBindings(links) } as InputValue : row;
  });
}

/** Resolves supported declared fields while keeping ordinary scalar geometry and styles. */
export function resolveBlockTokenBindings(rows: InputValue[], metadataField: string, fields: readonly BlockFieldSpec[], set: TokenSet | undefined, colorTarget: 'srgb' | 'rec2020' = 'srgb'): InputValue[] {
  const byId = new Map(fields.map(field => [field.id, field]));
  return reconcileBlockTokenBindings(rows, metadataField).map(row => {
    if (!record(row)) return row;
    const links = readBlockTokenBindings(row[metadataField]);
    if (!Object.keys(links).length) return row;
    const next = { ...row };
    for (const [id, link] of Object.entries(links)) {
      if (link.custom) continue;
      const field = byId.get(id);
      if (!field || id === metadataField) continue;
      const result = resolveTokenBinding(set?.get(aliasPath(link.ref)!), { ...field, type: field.type ?? 'text', colorTarget });
      if (result.status === 'linked' && scalar(result.value)) {
        next[id] = result.value; links[id] = { ref: link.ref, value: result.value, status: 'linked' };
      } else links[id] = { ...link, status: result.status, reason: result.reason };
    }
    next[metadataField] = encodeBindings(links);
    return next as InputValue;
  });
}

/** One explicit link/custom action, suitable for one transaction across a selection. */
export function withBlockTokenBinding(row: Row, metadataField: string, field: string, value: InputValue): Row {
  if (!safeField(field) || field === metadataField) throw new Error('This property cannot hold a token link.');
  const links = readBlockTokenBindings(row[metadataField]);
  if (isTokenValue(value) && scalar(value.value)) {
    const ref = `{${aliasPath(value.ref) ?? value.ref}}`;
    if (!isAlias(ref) || ref.length > 1024) throw new Error('This token reference is invalid or too long.');
    links[field] = { ref, value: value.value, status: 'linked' };
    return { ...row, [field]: value.value, [metadataField]: encodeBindings(links) };
  }
  if (!scalar(value)) throw new Error('A linked block property needs a scalar value.');
  if (links[field]) links[field] = { ref: links[field]!.ref, value: links[field]!.value, custom: true };
  return { ...row, [field]: value, [metadataField]: encodeBindings(links) };
}
