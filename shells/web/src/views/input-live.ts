// SPDX-License-Identifier: MPL-2.0
import { documentSchema, validateDocument } from '../../../../engine/src/document-api.ts';
import type { InputModelItem, InputSpec } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { LiveInputStateV1 } from '@lolly-tools/core';
import type { LiveEditor } from '../lib/live-agent.ts';

type Omission = LiveInputStateV1['omittedInputs'][number]['reason'];

/** Only plain JSON values travel on the live input channel. */
function jsonProblem(value: unknown, seen = new Set<object>(), depth = 0): Omission | null {
  if (depth > 64) return 'non-json';
  if (value === null || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'non-json';
  if (typeof value === 'string') return /^\s*(?:data|blob):/i.test(value) ? 'upload' : null;
  if (!value || typeof value !== 'object') return 'non-json';
  if (seen.has(value)) return 'non-json';
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return 'non-json';
  if (Object.hasOwn(value, '__file') || (!Array.isArray(value) && (value as Record<string, unknown>).source === 'user')) return 'upload';
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) return 'non-json';
    const reason = jsonProblem(item, seen, depth + 1);
    if (reason) return reason;
  }
  seen.delete(value);
  return null;
}

interface BinaryFingerprint { readonly binaryLength: number; readonly binaryHash: string }

/**
 * Hashes remembered per buffer and byte range, so a large file costs one pass
 * rather than one per revision read. The shell replaces file bytes with a new
 * array on every pick and never writes into them, so a remembered hash stays exact.
 */
const fingerprints = new WeakMap<ArrayBufferLike, Map<string, BinaryFingerprint>>();

function binaryFingerprint(value: ArrayBuffer | ArrayBufferView): BinaryFingerprint {
  const buffer = ArrayBuffer.isView(value) ? value.buffer : value;
  const offset = ArrayBuffer.isView(value) ? value.byteOffset : 0;
  const length = value.byteLength;
  const range = `${offset}:${length}`;
  const ranges = fingerprints.get(buffer) ?? new Map<string, BinaryFingerprint>();
  const known = ranges.get(range);
  if (known) return known;
  // A detached buffer reports zero bytes, and a view over it cannot be built.
  const bytes = length ? new Uint8Array(buffer, offset, length) : new Uint8Array(0);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i]!, 0x01000193);
  const fingerprint = Object.freeze({ binaryLength: length, binaryHash: (hash >>> 0).toString(16) });
  ranges.set(range, fingerprint);
  fingerprints.set(buffer, ranges);
  return fingerprint;
}

/** Fingerprint binary input state without returning its bytes to an agent. */
function revisionValue(value: unknown, seen = new Set<object>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return binaryFingerprint(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  const result = Array.isArray(value) ? value.map(item => revisionValue(item, seen)) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revisionValue(item, seen)]));
  seen.delete(value);
  return result;
}

function safeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'default' || !jsonProblem(item)).map(([key, item]) => [key, safeSchema(item)]));
}

export function liveInputState(manifest: ToolManifest, model: InputModelItem[], excluded: readonly string[] = []): LiveInputStateV1 {
  const inputValues: Record<string, unknown> = {};
  const editableInputIds: string[] = [];
  const omittedInputs: LiveInputStateV1['omittedInputs'] = [];
  for (const input of model) {
    const reason = input.type === 'file' ? 'file' : jsonProblem(input.value);
    if (reason) omittedInputs.push({ id: input.id, reason });
    else {
      inputValues[input.id] = structuredClone(input.value);
      if (!excluded.includes(input.id)) editableInputIds.push(input.id);
    }
  }
  const inputSchema = safeSchema(documentSchema({ ...manifest, inputs: model })) as Record<string, unknown>;
  const properties = inputSchema.properties as Record<string, Record<string, unknown>>;
  for (const input of model) if (!editableInputIds.includes(input.id)) properties[input.id] = { ...properties[input.id], readOnly: true };
  return { inputSchema, inputValues, editableInputIds, omittedInputs };
}

function strictFields(input: InputSpec, value: unknown, path: string): string[] {
  if (value === null || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  if (input.type === 'blocks' && Array.isArray(value)) {
    const fields = new Map((input.fields ?? []).map(field => [field.id, { ...field, type: field.type ?? 'text' } as InputSpec]));
    return value.flatMap((row, index) => row && typeof row === 'object' ? Object.entries(row).flatMap(([id, item]) => fields.has(id) ? strictFields(fields.get(id)!, item, `${path}/${index}/${id}`) : []) : []);
  }
  const keys = input.type === 'vector' ? (input.fields ?? []).map(field => field.id)
    : input.type === 'table' ? ['columns', 'rows']
    : input.type === 'color' ? ['ref', 'value']
    : input.type === 'asset' ? ['source', 'id', 'type', 'format', 'url', 'original', 'width', 'height', 'version', 'pin', 'checksum', 'meta'] : null;
  if (!keys) return [];
  const errors = Object.keys(object).filter(key => !keys.includes(key)).map(key => `${path}/${key}: unknown field`);
  if (input.type === 'vector') {
    for (const field of input.fields ?? []) if (Object.hasOwn(object, field.id)) {
      const item = object[field.id];
      if (typeof item !== 'number' || !Number.isFinite(item)) errors.push(`${path}/${field.id}: must be a finite number`);
      else if (field.min !== undefined && item < field.min || field.max !== undefined && item > field.max) errors.push(`${path}/${field.id}: outside the declared range`);
    }
  }
  if (input.type === 'table') {
    const columns = object.columns, rows = object.rows;
    if (!Array.isArray(columns) || columns.some(item => typeof item !== 'string')) errors.push(`${path}/columns: must contain strings`);
    if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row) || row.some(item => typeof item !== 'string') || Array.isArray(columns) && row.length !== columns.length)) errors.push(`${path}/rows: must contain rectangular rows of strings`);
  }
  if (input.type === 'color' && (typeof object.ref !== 'string' || Object.hasOwn(object, 'value') && typeof object.value !== 'string')) errors.push(`${path}: use a color string or { ref, value? }`);
  if (input.type === 'asset') {
    for (const key of ['source', 'id', 'type', 'format', 'url', 'version', 'checksum']) if (Object.hasOwn(object, key) && typeof object[key] !== 'string') errors.push(`${path}/${key}: must be a string`);
    for (const key of ['width', 'height']) if (Object.hasOwn(object, key) && typeof object[key] !== 'number') errors.push(`${path}/${key}: must be a number`);
    if (object.source !== undefined && !['library', 'remote'].includes(String(object.source))) errors.push(`${path}/source: use a catalog or remote reference`);
    for (const [key, fields] of [['original', ['url', 'format']], ['pin', ['version', 'format']]] as const) if (object[key] !== undefined) {
      const item = object[key];
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.entries(item).some(([field, value]) => !fields.includes(field as never) || typeof value !== 'string')) errors.push(`${path}/${key}: invalid reference fields`);
    }
  }
  return errors;
}

export interface InputLiveDeps {
  documentId?: string;
  manifest: ToolManifest;
  engine: string;
  surface: 'desktop' | 'web';
  runtime: { getModel(): InputModelItem[] };
  context?: LiveEditor['context'];
  size(): { width: number; height: number };
  excludedInputIds?: readonly string[];
  history: { commit(values: Record<string, unknown>, label: string): Promise<void>; top(): object | null; undo(): void };
  readOnly(): boolean;
  label(note: string, client?: string): string;
  exportSvg(): Promise<Blob>;
}

/** Runtime and history remain the only input write path. */
export function inputLiveEditor(d: InputLiveDeps): LiveEditor {
  const inputs = () => liveInputState(d.manifest, d.runtime.getModel(), d.excludedInputIds);
  const revisionInputs = () => Object.fromEntries(d.runtime.getModel().map(input => [input.id, revisionValue(input.value)]));
  const canLook = () => !!d.manifest.render.formats.includes('svg');
  return {
    documentId: d.documentId, owner: d.runtime, tool: d.manifest.id, toolVersion: d.manifest.version, engine: d.engine, surface: d.surface,
    adapter: 'inputs', context: d.context, inputs, revisionInputs, canLook,
    rows: () => [], selection: () => [], size: d.size, fieldDefault: (_id, fallback) => fallback,
    async commit() { throw new Error('This tool uses inputValues rather than layer edits.'); },
    validateInputs(values) {
      const model = d.runtime.getModel();
      const editable = new Set(inputs().editableInputIds);
      const errors: string[] = [];
      for (const [id, value] of Object.entries(values)) {
        const input = model.find(item => item.id === id);
        if (!input) errors.push(`/${id}: unknown input`);
        else if (!editable.has(id)) errors.push(`/${id}: this input is not available for live editing`);
        else if (jsonProblem(value)) errors.push(`/${id}: use JSON values without files or uploaded bytes`);
        else errors.push(...strictFields(input, value, `/${id}`));
      }
      if (!errors.length) errors.push(...validateDocument({ kind: 'inputs', manifest: { ...d.manifest, inputs: model.filter(input => Object.hasOwn(values, input.id)) }, value: values }).errors.map(issue => `${issue.path}: ${issue.message}`));
      return errors;
    },
    async commitInputs(values, note, client) {
      if (d.readOnly()) throw new Error('This document is read-only.');
      const before = d.history.top();
      const pending = d.history.commit(values, d.label(note, client));
      const after = d.history.top();
      const admittedInputs = revisionInputs();
      await pending;
      return { entry: after && after !== before ? after : null, admittedInputs };
    },
    topEntry: d.history.top, undo: d.history.undo,
    readOnly: () => d.readOnly() || !inputs().editableInputIds.length,
    async look() {
      if (!canLook()) throw new Error('This tool does not support a live SVG preview.');
      return { svg: await (await d.exportSvg()).text(), ...d.size() };
    },
  };
}
