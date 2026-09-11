// SPDX-License-Identifier: MPL-2.0
/** A finite data recipe expands to ordinary batch rows. No rendering or storage. */
import { buildInputModel } from '@lolly/engine';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

export interface KitField {
  id: string; label: string; type: 'text' | 'url' | 'asset';
  required?: boolean; maxLength?: number; default?: string;
}
export interface KitBinding { field: string; input: string; box?: string; property?: string }
export interface KitOutput {
  id: string; name: string; toolId: string; format: string;
  width: number; height: number; unit: 'px' | 'mm'; values: Record<string, InputValue>;
  bindings: KitBinding[];
}
export interface KitDefinition { version: 1; id: string; name: string; fields: KitField[]; outputs: KitOutput[] }
export interface KitState {
  version: 1; source: string; definition: KitDefinition; brief: Record<string, InputValue>;
  detached: Record<string, string[]>;
}
export interface KitRow {
  toolId: string; values: Record<string, InputValue>; kitOutputId?: string;
  manifest: ToolManifest | null; format?: string; filename?: string;
  outWidth?: number; outHeight?: number; unit?: string; dpi?: number;
}
type RecordValue = { [key: string]: InputValue | undefined };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const key = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v) && !['constructor', 'prototype'].includes(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const json = (v: unknown, depth = 0): boolean => depth <= 24 && (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v)) || (Array.isArray(v) ? v.every(x => json(x, depth + 1)) : record(v) && Object.entries(v).every(([k, x]) => !['__proto__', 'constructor', 'prototype'].includes(k) && json(x, depth + 1))));

/** Bound imported definitions before traversal; reject unknown bindings, never evaluate them. */
export function parseKitDefinition(raw: unknown): KitDefinition {
  const encoded = JSON.stringify(raw);
  if (!encoded || encoded.length > 200_000 || !record(raw) || raw.version !== 1 || !key(raw.id) || !text(raw.name)) throw new Error('Unsupported production kit.');
  if (!Array.isArray(raw.fields) || !raw.fields.length || raw.fields.length > 16 || !Array.isArray(raw.outputs) || !raw.outputs.length || raw.outputs.length > 8) throw new Error('Invalid kit size.');
  const fields = new Set<string>(), outputs = new Set<string>();
  for (const f of raw.fields) {
    if (!record(f) || !key(f.id) || fields.has(f.id) || !text(f.label) || typeof f.type !== 'string' || !['text', 'url', 'asset'].includes(f.type)) throw new Error('Invalid kit field.');
    if (f.maxLength !== undefined && (!Number.isInteger(f.maxLength) || Number(f.maxLength) < 1 || Number(f.maxLength) > 2048)) throw new Error('Invalid field length.');
    if (f.required !== undefined && typeof f.required !== 'boolean') throw new Error('Invalid field requirement.');
    if (f.default !== undefined && (typeof f.default !== 'string' || f.default.length > 2048)) throw new Error('Invalid field default.');
    fields.add(f.id);
  }
  for (const o of raw.outputs) {
    if (!record(o) || !key(o.id) || outputs.has(o.id) || !text(o.name) || !key(o.toolId) || typeof o.format !== 'string' || !['png', 'pdf', 'svg'].includes(o.format) || typeof o.unit !== 'string' || !['px', 'mm'].includes(o.unit)) throw new Error('Invalid kit output.');
    if (![o.width, o.height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 4096) || !record(o.values) || !json(o.values)) throw new Error('Invalid kit dimensions or values.');
    if (!Array.isArray(o.bindings) || o.bindings.length > 32) throw new Error('Invalid kit bindings.');
    const targets = new Set<string>();
    for (const b of o.bindings) {
      if (!record(b) || !fields.has(String(b.field)) || !key(b.input) || (b.box !== undefined && (!key(b.box) || !key(b.property))) || (b.box === undefined && b.property !== undefined)) throw new Error('Invalid kit binding.');
      const target = `${b.input}/${b.box ?? ''}/${b.property ?? ''}`;
      if (targets.has(target)) throw new Error('Two fields cannot own the same target.');
      targets.add(target);
    }
    outputs.add(o.id);
  }
  return { version: 1, id: raw.id, name: raw.name, fields: structuredClone(raw.fields) as KitField[], outputs: structuredClone(raw.outputs) as KitOutput[] };
}

export function restoreKit(raw: unknown): KitState | undefined {
  if (raw === undefined) return undefined;
  if (!record(raw) || raw.version !== 1 || typeof raw.source !== 'string' || raw.source.length > 160 || !record(raw.brief) || !record(raw.detached)) throw new Error('Invalid saved kit.');
  const definition = parseKitDefinition(raw.definition);
  if (JSON.stringify(raw.brief).length > 50_000 || !json(raw.brief)) throw new Error('Invalid saved brief.');
  const detached: Record<string, string[]> = {};
  for (const o of definition.outputs) {
    const v = raw.detached[o.id] ?? [];
    if (!Array.isArray(v) || v.length > 16 || !v.every(f => definition.fields.some(field => field.id === f))) throw new Error('Invalid saved field links.');
    detached[o.id] = [...new Set(v as string[])];
  }
  return { version: 1, source: raw.source, definition, brief: structuredClone(raw.brief) as Record<string, InputValue>, detached };
}

export function kitIssues(kit: KitState): string[] {
  return kit.definition.fields.flatMap(f => {
    const v = kit.brief[f.id];
    if (f.type === 'asset') {
      if (!v) return f.required ? [`${f.label} is required.`] : [];
      const id = typeof v === 'string' ? v : record(v) ? v.id : null;
      return typeof id === 'string' && id.length > 0 && id.length <= 2048 ? [] : [`${f.label} must be an asset from your library.`];
    }
    const s = typeof v === 'string' ? v : '';
    if (f.required && !s.trim()) return [`${f.label} is required.`];
    if (s.length > (f.maxLength ?? 2048)) return [`${f.label} is too long.`];
    if (f.type === 'url' && s) {
      try { if (!['https:', 'http:'].includes(new URL(s).protocol)) throw new Error(); }
      catch { return [`${f.label} must be an http or https URL.`]; }
    }
    return [];
  });
}

function boxFor(row: KitRow, b: KitBinding): RecordValue {
  const blocks = row.values[b.input];
  if (!Array.isArray(blocks)) throw new Error(`Missing block input ${b.input}.`);
  const matches = blocks.filter(v => record(v) && v.id === b.box);
  if (matches.length !== 1) throw new Error(`Missing or duplicate content slot ${b.box}.`);
  return matches[0] as RecordValue;
}
export function boundValue(row: KitRow, b: KitBinding): InputValue {
  return (b.box ? boxFor(row, b)[b.property!] : row.values[b.input]) ?? '';
}
function writeBound(row: KitRow, b: KitBinding, value: InputValue): void {
  const input = row.manifest?.inputs?.find(i => i.id === b.input);
  if (!input) throw new Error(`Missing input ${b.input} in ${row.toolId}.`);
  if (b.box) {
    if (input.type !== 'blocks' || !input.fields?.some(f => f.id === b.property)) throw new Error(`Missing block property ${b.property}.`);
    boxFor(row, b)[b.property!] = structuredClone(value);
  } else row.values[b.input] = structuredClone(value);
}

function checkTarget(row: KitRow, b: KitBinding, field: KitField): void {
  const spec = row.manifest?.inputs.find(i => i.id === b.input);
  const target = b.box ? (spec?.type === 'blocks' ? spec.fields?.find(f => f.id === b.property) : undefined) : spec;
  if (!target || (field.type === 'asset' ? target.type !== 'asset' : !['text', 'longtext', 'url'].includes(target.type ?? ''))) throw new Error(`Incompatible field ${field.label} in ${row.toolId}.`);
}

/** Mark a deliberate grid edit as detached before applying newer shared values. */
export function captureKitEdits(kit: KitState, rows: KitRow[]): void {
  for (const o of kit.definition.outputs) {
    const matches = rows.filter(r => r.kitOutputId === o.id);
    const row = matches.length === 1 ? matches[0] : undefined;
    if (!row) continue;
    kit.detached[o.id] ??= [];
    const detached = kit.detached[o.id]!;
    for (const b of o.bindings) {
      // A missing slot is reported by kitRowIssues. It must not break the
      // unsaved-changes guard or turn a damaged row into an implicit detach.
      try {
        if (!detached.includes(b.field) && JSON.stringify(boundValue(row, b)) !== JSON.stringify(kit.brief[b.field] ?? '')) detached.push(b.field);
      } catch { /* preserve the binding for repair */ }
    }
  }
}

export function kitRowIssues(kit: KitState, rows: KitRow[]): string[] {
  return kit.definition.outputs.flatMap(o => {
    const matches = rows.filter(r => r.kitOutputId === o.id);
    if (matches.length !== 1) return [`${o.name}: its output row is missing or duplicated.`];
    const row = matches[0];
    if (!row?.manifest || row.toolId !== o.toolId) return [`${o.name}: its tool or row is unavailable.`];
    const brief = { ...kit.brief };
    try { for (const b of o.bindings) { checkTarget(row, b, kit.definition.fields.find(f => f.id === b.field)!); brief[b.field] = boundValue(row, b); } }
    catch (e) { return [`${o.name}: ${e instanceof Error ? e.message : String(e)}`]; }
    return kitIssues({ ...kit, brief }).map(message => `${o.name}: ${message}`);
  });
}

export function applyKit(kit: KitState, rows: KitRow[]): void {
  // Validate and write clones first: a stale slot cannot half-update a batch.
  const patches: Array<[KitRow, KitRow]> = [];
  for (const o of kit.definition.outputs) {
    const matches = rows.filter(r => r.kitOutputId === o.id);
    if (matches.length !== 1) throw new Error(`${o.name}: its output row is missing or duplicated.`);
    const row = matches[0];
    if (!row || row.toolId !== o.toolId || !row.manifest) throw new Error(`${o.name}: its tool or row is unavailable.`);
    const next = { ...row, values: structuredClone(row.values) };
    for (const b of o.bindings) {
      checkTarget(next, b, kit.definition.fields.find(f => f.id === b.field)!);
      if (!kit.detached[o.id]?.includes(b.field)) writeBound(next, b, kit.brief[b.field] ?? '');
    }
    patches.push([row, next]);
  }
  for (const [row, next] of patches) row.values = next.values;
}

export function createKitRows(definition: KitDefinition, manifests: Map<string, ToolManifest>): { kit: KitState; rows: KitRow[] } {
  const kit: KitState = { version: 1, source: 'design:event-kit', definition, brief: {}, detached: {} };
  for (const f of definition.fields) kit.brief[f.id] = f.default ?? '';
  const rows = definition.outputs.map(o => {
    const manifest = manifests.get(o.toolId);
    if (!manifest?.render.formats.includes(o.format)) throw new Error(`${o.name}: ${o.format.toUpperCase()} is unavailable.`);
    return { toolId: o.toolId, manifest, kitOutputId: o.id,
      values: Object.fromEntries(buildInputModel(manifest, { initial: structuredClone(o.values) }).map(i => [i.id, i.value])),
      format: o.format, outWidth: o.width, outHeight: o.height, unit: o.unit, dpi: 300, filename: `event-${o.id}` };
  });
  applyKit(kit, rows);
  return { kit, rows };
}
